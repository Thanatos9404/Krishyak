"""Compatibility entry point for the source-traceable candidate training pipeline.

Prepare data first with prepare_disease_manifest.py. All training options are
documented by --help. Production model files are never overwritten by training.
"""
from train_authentic_model import main

if __name__ == '__main__':
    main()
