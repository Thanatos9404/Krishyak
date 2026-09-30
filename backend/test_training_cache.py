import unittest
from train_authentic_model import cache_matches

class TrainingCacheContracts(unittest.TestCase):
    def test_feature_cache_requires_same_backbone_and_manifest(self):
        cache={'manifest_sha256':'abc','backbone':'ImageNet MobileNetV2'}
        self.assertTrue(cache_matches(cache,'abc','ImageNet MobileNetV2'))
        self.assertFalse(cache_matches(cache,'abc','ImageNet EfficientNetV2B0'))
        self.assertFalse(cache_matches(cache,'other','ImageNet MobileNetV2'))
        self.assertFalse(cache_matches({},'abc','ImageNet MobileNetV2'))
