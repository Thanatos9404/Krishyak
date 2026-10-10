"""Export the selected classifier without quantization and fail on numerical drift.
Run with requirements-ml.txt. This verifies conversion, not diagnostic accuracy.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
os.environ.setdefault('TF_CPP_MIN_LOG_LEVEL','2')
import numpy as np
import tensorflow as tf
from PIL import Image, ImageOps

def export(bundle, photos, reference):
    source=bundle/'model.keras'
    source_digest=hashlib.sha256(source.read_bytes()).hexdigest()
    release=json.loads((bundle/'release.json').read_text())
    labels_digest=hashlib.sha256((bundle/'class_indices.json').read_bytes()).hexdigest()
    if release['model_sha256'] != source_digest or release['class_indices_sha256'] != labels_digest:
        raise ValueError('Source model or labels do not match the selected release')
    model=tf.keras.models.load_model(source,compile=False)
    converter=tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations=[]
    converter.target_spec.supported_ops=[tf.lite.OpsSet.TFLITE_BUILTINS]
    artifact=converter.convert()
    interpreter=tf.lite.Interpreter(model_content=artifact,num_threads=2)
    interpreter.allocate_tensors()
    rng=np.random.default_rng(731)
    tensors=[np.zeros((1,224,224,3),np.float32),np.ones((1,224,224,3),np.float32)]
    tensors.extend(rng.random((1,224,224,3),dtype=np.float32) for _ in range(8))
    for path in photos:
        with Image.open(path) as image:
            image=ImageOps.exif_transpose(image)
            if image.mode in ('RGBA','LA') or 'transparency' in image.info:
                image=Image.alpha_composite(Image.new('RGBA',image.size,'white'),image.convert('RGBA'))
            tensors.append(np.asarray(image.convert('RGB').resize((224,224)),dtype=np.float32)[None]/np.float32(255))
    errors=[]
    expected=[]
    for x in tensors:
        y=np.asarray(model(x,training=False))
        interpreter.set_tensor(interpreter.get_input_details()[0]['index'],x)
        interpreter.invoke()
        got=interpreter.get_tensor(interpreter.get_output_details()[0]['index'])
        np.testing.assert_allclose(got,y,rtol=1e-4,atol=1e-5)
        assert np.argmax(got)==np.argmax(y), 'Top prediction changed'
        assert bool(got.max() < .75)==bool(y.max() < .75), 'Abstention threshold changed'
        errors.append(float(np.max(np.abs(got-y))))
        expected.append(y)
    report={'format':'TFLite float32, built-in operators only; no quantization','source_sha256':source_digest,'artifact_sha256':hashlib.sha256(artifact).hexdigest(),'class_indices_sha256':labels_digest,'artifact_bytes':len(artifact),'samples':len(tensors),'photo_samples':len(photos),'top1_matches':len(tensors),'abstention_threshold_matches':len(tensors),'max_absolute_probability_error':max(errors),'rtol':1e-4,'atol':1e-5,'coverage':'Ten deterministic synthetic tensors, bundled demo photograph, and locally available PlantDoc-export test photographs. Numerical equivalence check, not a new disease accuracy evaluation.'}
    (bundle/'model.tflite').write_bytes(artifact)
    (bundle/'runtime-verification.json').write_text(json.dumps(report,indent=2)+'\n')
    if reference:
        np.savez_compressed(reference,inputs=np.concatenate(tensors),outputs=np.concatenate(expected))
    print(json.dumps(report))

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bundle',type=Path,default=Path(__file__).parent/'models/active')
    parser.add_argument('--photo-dir',type=Path)
    parser.add_argument('--reference',type=Path)
    args=parser.parse_args()
    photos=[Path(__file__).parents[1]/'frontend/public/sample-crop-leaf.jpg']
    if args.photo_dir:
        photos.extend(sorted(p for p in args.photo_dir.rglob('*') if p.suffix.lower() in {'.png','.jpg','.jpeg','.webp'}))
    export(args.bundle,photos,args.reference)
