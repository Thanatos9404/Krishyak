"""External identity and storage providers. Test identity is explicitly isolated."""

import hashlib
import io
import secrets
from abc import ABC, abstractmethod
from pathlib import Path

import httpx
from fastapi import HTTPException
from PIL import Image, ImageOps


class OTPProvider(ABC):
    @abstractmethod
    def send(self, mobile: str) -> str: ...

    @abstractmethod
    def check(self, mobile: str, reference: str, code: str) -> bool: ...


class DevelopmentOTPProvider(OTPProvider):
    def __init__(self, settings):
        if settings.deployed or settings.otp_provider != "development":
            raise ValueError("Development OTP prohibited")
        self.mobiles = set(settings.dev_mobiles)

    def send(self, mobile):
        if mobile not in self.mobiles:
            raise HTTPException(400, "Use a configured synthetic development identity")
        return "development"

    def check(self, mobile, reference, code):
        return mobile in self.mobiles and reference == "development" and secrets.compare_digest(code, "123456")


class TwilioOTPProvider(OTPProvider):
    def __init__(self, settings):
        import re

        if not re.fullmatch(r"VA[0-9a-fA-F]{32}", settings.twilio_service):
            raise ValueError("Invalid Twilio Verify service identifier")
        self.url = f"https://verify.twilio.com/v2/Services/{settings.twilio_service}"
        self.auth = (settings.twilio_account.get_secret_value(), settings.twilio_token.get_secret_value())

    def _post(self, path, data):
        try:
            with httpx.Client(timeout=10, follow_redirects=False) as client:
                response = client.post(self.url + path, data=data, auth=self.auth)
            if response.status_code == 429:
                raise HTTPException(429, "Verification temporarily limited; retry later")
            if response.status_code == 404:
                return {"status": "expired"}
            response.raise_for_status()
            result = response.json()
            if not isinstance(result, dict):
                raise ValueError()
            return result
        except (httpx.HTTPError, ValueError):
            raise HTTPException(503, "Phone verification unavailable") from None

    def send(self, mobile):
        result = self._post("/Verifications", {"To": mobile, "Channel": "sms"})
        reference = result.get("sid")
        if result.get("status") != "pending" or not isinstance(reference, str) or not reference.startswith("VE"):
            raise HTTPException(503, "Phone verification unavailable")
        return reference

    def check(self, mobile, reference, code):
        result = self._post("/VerificationCheck", {"VerificationSid": reference, "Code": code})
        return result.get("status") == "approved" and result.get("to") == mobile


def otp_provider(settings):
    if settings.otp_provider == "development":
        return DevelopmentOTPProvider(settings)
    if settings.otp_provider == "twilio":
        return TwilioOTPProvider(settings)
    raise HTTPException(503, "Phone sign-in is unavailable")


class ObjectStorage(ABC):
    @abstractmethod
    def put(self, key: str, data: bytes) -> None: ...

    @abstractmethod
    def get(self, key: str) -> bytes: ...

    @abstractmethod
    def delete(self, key: str) -> None: ...


class LocalStorage(ObjectStorage):
    def __init__(self, root: Path):
        self.root = root.resolve()

    def path(self, key):
        target = (self.root / key).resolve()
        if not target.is_relative_to(self.root) or target == self.root:
            raise ValueError("Invalid object key")
        return target

    def put(self, key, data):
        path = self.path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        # UUID keys never overwrite another owner's object.
        with path.open("xb") as stream:
            stream.write(data)

    def get(self, key):
        return self.path(key).read_bytes()

    def delete(self, key):
        self.path(key).unlink(missing_ok=True)


class S3Storage(ObjectStorage):
    def __init__(self, settings):
        import boto3
        from botocore.config import Config

        self.bucket = settings.s3_bucket
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint or None,
            config=Config(connect_timeout=5, read_timeout=15, retries={"max_attempts": 2}),
        )

    def put(self, key, data):
        self.client.put_object(
            Bucket=self.bucket, Key=key, Body=data, ContentType="image/jpeg", ServerSideEncryption="AES256"
        )

    def get(self, key):
        response = self.client.get_object(Bucket=self.bucket, Key=key)
        with response["Body"] as stream:
            return stream.read(8 * 1024 * 1024 + 1)

    def delete(self, key):
        self.client.delete_object(Bucket=self.bucket, Key=key)


def object_storage(settings):
    return S3Storage(settings) if settings.storage_provider == "s3" else LocalStorage(settings.storage_root)


def sanitize_image(content: bytes, mime: str):
    from security import FileValidator

    if len(content) > 8 * 1024 * 1024:
        raise ValueError("Image exceeds 8 MB")
    FileValidator.validate_image_upload(content, mime)
    with Image.open(io.BytesIO(content)) as image:
        if image.width * image.height > 20_000_000 or max(image.size) > 8192 or getattr(image, "n_frames", 1) != 1:
            raise ValueError("Unsupported image dimensions or animation")
        image.load()
        oriented = ImageOps.exif_transpose(image)
        oriented.thumbnail((2048, 2048), Image.Resampling.LANCZOS)
        rgba = oriented.convert("RGBA")
        white = Image.new("RGBA", rgba.size, "white")
        white.alpha_composite(rgba)
        rgb = white.convert("RGB")
        output = io.BytesIO()
        rgb.save(output, "JPEG", quality=92)
        data = output.getvalue()
        if len(data) > 8 * 1024 * 1024:
            raise ValueError("Decoded image exceeds storage limit")
        return data, rgb.width, rgb.height, hashlib.sha256(data).hexdigest()
