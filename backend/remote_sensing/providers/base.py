from abc import ABC, abstractmethod


class ProviderError(Exception):
    def __init__(self, code, message, status=503, retry_after=None):
        super().__init__(message)
        self.code, self.message, self.status, self.retry_after = code, message, status, retry_after


class RemoteSensingProvider(ABC):
    name = "unknown"
    capabilities = {"supports_optical": False, "supports_sar": False, "supports_statistics": False,
                    "supports_timeseries": False, "supports_batch": False, "supports_crop_classification": False}

    @abstractmethod
    def healthcheck(self): ...

    @abstractmethod
    def search_acquisitions(self, request): ...

    @abstractmethod
    def get_visualization(self, request): ...

    @abstractmethod
    def get_statistics(self, request): ...

    def get_time_series(self, request):
        return self.get_statistics(request)
