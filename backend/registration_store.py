"""Serialize local CSV registration writes across workers and flush before success.

This local export is not a replacement for authenticated durable production storage.
"""
from contextlib import contextmanager
import csv
import io
import os
from pathlib import Path


@contextmanager
def exclusive_lock(path):
    with open(str(path) + '.lock', 'a+b') as lock:
        if os.name == 'nt':
            import msvcrt
            if os.fstat(lock.fileno()).st_size == 0:
                lock.write(b'\0')
                lock.flush()
            lock.seek(0)
            msvcrt.locking(lock.fileno(), msvcrt.LK_LOCK, 1)
        else:
            import fcntl
            fcntl.flock(lock, fcntl.LOCK_EX)
        try:
            yield
        finally:
            if os.name == 'nt':
                lock.seek(0)
                msvcrt.locking(lock.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(lock, fcntl.LOCK_UN)


def append_registration(path, fields, row):
    path = Path(path)
    with exclusive_lock(path), open(path, 'a+b', buffering=0) as file:
        file.seek(0, os.SEEK_END)
        original_size = file.tell()
        if original_size:
            file.seek(0)
            header = next(csv.reader([file.readline().decode('utf-8')]))
            if header != fields:
                raise ValueError('Existing registration CSV has an incompatible header')
            file.seek(-1, os.SEEK_END)
            if file.read(1) != b'\n':
                raise ValueError('Existing registration CSV contains an incomplete final record')
        buffer = io.StringIO(newline='')
        writer = csv.DictWriter(buffer, fieldnames=fields)
        if not original_size:
            writer.writeheader()
        writer.writerow(row)
        try:
            remaining = memoryview(buffer.getvalue().encode('utf-8'))
            while remaining:
                written = file.write(remaining)
                if not written:
                    raise OSError('Registration write made no progress')
                remaining = remaining[written:]
            os.fsync(file.fileno())
        except Exception:
            file.truncate(original_size)
            raise
