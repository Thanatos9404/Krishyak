"""
Plant Disease Detection Model Training Script
Uses Transfer Learning with MobileNetV2 for efficient inference
Dataset: Custom pdisease dataset with 42 classes
"""

import os
import sys
import json
import numpy as np
from pathlib import Path
import warnings
warnings.filterwarnings('ignore')

# TensorFlow setup
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'  # Reduce TF logging

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.layers import Dense, GlobalAveragePooling2D, Dropout, BatchNormalization
from tensorflow.keras.models import Model, load_model
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.callbacks import ModelCheckpoint, EarlyStopping, ReduceLROnPlateau, TensorBoard
from tensorflow.keras.optimizers import Adam

# Configuration
CONFIG = {
    "dataset_path": "../datasets/pdisease",
    "model_save_path": "./models/plant_disease_model.h5",
    "class_indices_path": "./models/class_indices.json",
    "img_size": (224, 224),
    "batch_size": 32,
    "epochs": 30,
    "learning_rate": 0.001,
    "fine_tune_learning_rate": 0.0001,
    "fine_tune_epochs": 10,
    "validation_split": 0.2
}


def create_data_generators(dataset_path, img_size, batch_size):
    """Create training and validation data generators with augmentation"""
    
    train_datagen = ImageDataGenerator(
        rescale=1./255,
        rotation_range=40,
        width_shift_range=0.2,
        height_shift_range=0.2,
        shear_range=0.2,
        zoom_range=0.2,
        horizontal_flip=True,
        vertical_flip=True,
        brightness_range=[0.8, 1.2],
        fill_mode='nearest'
    )
    
    val_datagen = ImageDataGenerator(rescale=1./255)
    
    train_dir = os.path.join(dataset_path, "Train")
    val_dir = os.path.join(dataset_path, "Validation")
    
    print(f"Loading training data from: {train_dir}")
    train_generator = train_datagen.flow_from_directory(
        train_dir,
        target_size=img_size,
        batch_size=batch_size,
        class_mode='categorical',
        shuffle=True
    )
    
    print(f"Loading validation data from: {val_dir}")
    val_generator = val_datagen.flow_from_directory(
        val_dir,
        target_size=img_size,
        batch_size=batch_size,
        class_mode='categorical',
        shuffle=False
    )
    
    return train_generator, val_generator


def build_model(num_classes, img_size):
    """Build transfer learning model with MobileNetV2 backbone"""
    
    # Load pre-trained MobileNetV2 (lightweight, good for deployment)
    base_model = MobileNetV2(
        weights='imagenet',
        include_top=False,
        input_shape=(*img_size, 3)
    )
    
    # Freeze base model layers initially
    base_model.trainable = False
    
    # Add custom classification head
    x = base_model.output
    x = GlobalAveragePooling2D()(x)
    x = BatchNormalization()(x)
    x = Dense(512, activation='relu')(x)
    x = Dropout(0.5)(x)
    x = BatchNormalization()(x)
    x = Dense(256, activation='relu')(x)
    x = Dropout(0.3)(x)
    predictions = Dense(num_classes, activation='softmax')(x)
    
    model = Model(inputs=base_model.input, outputs=predictions)
    
    return model, base_model


def get_callbacks(model_path):
    """Create training callbacks"""
    
    os.makedirs(os.path.dirname(model_path), exist_ok=True)
    
    callbacks = [
        ModelCheckpoint(
            model_path,
            monitor='val_accuracy',
            save_best_only=True,
            mode='max',
            verbose=1
        ),
        EarlyStopping(
            monitor='val_loss',
            patience=5,
            restore_best_weights=True,
            verbose=1
        ),
        ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.2,
            patience=3,
            min_lr=1e-7,
            verbose=1
        )
    ]
    
    return callbacks


def train_model():
    """Main training function"""
    
    print("=" * 60)
    print("🌿 Plant Disease Detection Model Training")
    print("=" * 60)
    
    # Check GPU availability
    gpus = tf.config.list_physical_devices('GPU')
    if gpus:
        print(f"✅ GPU detected: {gpus}")
        for gpu in gpus:
            tf.config.experimental.set_memory_growth(gpu, True)
    else:
        print("⚠️ No GPU detected, training on CPU (will be slower)")
    
    # Create data generators
    print("\n📂 Loading dataset...")
    train_gen, val_gen = create_data_generators(
        CONFIG["dataset_path"],
        CONFIG["img_size"],
        CONFIG["batch_size"]
    )
    
    num_classes = len(train_gen.class_indices)
    print(f"✅ Found {num_classes} disease classes")
    print(f"✅ Training samples: {train_gen.samples}")
    print(f"✅ Validation samples: {val_gen.samples}")
    
    # Save class indices for inference
    os.makedirs(os.path.dirname(CONFIG["class_indices_path"]), exist_ok=True)
    with open(CONFIG["class_indices_path"], 'w') as f:
        # Invert the dictionary for prediction
        class_indices = {v: k for k, v in train_gen.class_indices.items()}
        json.dump(class_indices, f, indent=2)
    print(f"✅ Saved class indices to {CONFIG['class_indices_path']}")
    
    # Build model
    print("\n🏗️ Building model with MobileNetV2 backbone...")
    model, base_model = build_model(num_classes, CONFIG["img_size"])
    
    # Compile model
    model.compile(
        optimizer=Adam(learning_rate=CONFIG["learning_rate"]),
        loss='categorical_crossentropy',
        metrics=['accuracy']
    )
    
    model.summary()
    
    # Phase 1: Train classification head only
    print("\n" + "=" * 60)
    print("📚 Phase 1: Training classification head (frozen base)...")
    print("=" * 60)
    
    callbacks = get_callbacks(CONFIG["model_save_path"])
    
    history1 = model.fit(
        train_gen,
        epochs=CONFIG["epochs"],
        validation_data=val_gen,
        callbacks=callbacks,
        verbose=1
    )
    
    # Phase 2: Fine-tuning (unfreeze some base layers)
    print("\n" + "=" * 60)
    print("🔧 Phase 2: Fine-tuning with unfrozen layers...")
    print("=" * 60)
    
    # Unfreeze top layers of base model
    base_model.trainable = True
    # Freeze first 100 layers, fine-tune the rest
    for layer in base_model.layers[:100]:
        layer.trainable = False
    
    # Recompile with lower learning rate
    model.compile(
        optimizer=Adam(learning_rate=CONFIG["fine_tune_learning_rate"]),
        loss='categorical_crossentropy',
        metrics=['accuracy']
    )
    
    history2 = model.fit(
        train_gen,
        epochs=CONFIG["fine_tune_epochs"],
        validation_data=val_gen,
        callbacks=callbacks,
        verbose=1
    )
    
    # Final evaluation
    print("\n" + "=" * 60)
    print("📊 Final Evaluation")
    print("=" * 60)
    
    # Load best model
    best_model = load_model(CONFIG["model_save_path"])
    val_loss, val_acc = best_model.evaluate(val_gen, verbose=0)
    
    print(f"✅ Best Validation Accuracy: {val_acc * 100:.2f}%")
    print(f"✅ Best Validation Loss: {val_loss:.4f}")
    print(f"✅ Model saved to: {CONFIG['model_save_path']}")
    
    return best_model, history1, history2


def predict_disease(model_path, image_path, class_indices_path):
    """Predict disease from an image"""
    
    # Load model and class indices
    model = load_model(model_path)
    with open(class_indices_path, 'r') as f:
        class_indices = json.load(f)
    
    # Load and preprocess image
    img = keras.preprocessing.image.load_img(
        image_path,
        target_size=CONFIG["img_size"]
    )
    img_array = keras.preprocessing.image.img_to_array(img)
    img_array = np.expand_dims(img_array, axis=0)
    img_array = img_array / 255.0
    
    # Predict
    predictions = model.predict(img_array, verbose=0)
    predicted_class_idx = np.argmax(predictions[0])
    confidence = predictions[0][predicted_class_idx]
    
    # Get class name
    class_name = class_indices[str(predicted_class_idx)]
    
    return class_name, confidence, predictions[0]


if __name__ == "__main__":
    print("\n🌱 Starting Plant Disease Detection Model Training...\n")
    
    try:
        model, history1, history2 = train_model()
        print("\n✅ Training completed successfully!")
        
        # Test prediction on a sample image
        test_images_dir = os.path.join(CONFIG["dataset_path"], "Validation")
        if os.path.exists(test_images_dir):
            # Find first image in validation
            for class_dir in os.listdir(test_images_dir):
                class_path = os.path.join(test_images_dir, class_dir)
                if os.path.isdir(class_path):
                    images = os.listdir(class_path)
                    if images:
                        test_image = os.path.join(class_path, images[0])
                        print(f"\n🔍 Testing on: {test_image}")
                        disease, confidence, _ = predict_disease(
                            CONFIG["model_save_path"],
                            test_image,
                            CONFIG["class_indices_path"]
                        )
                        print(f"Predicted: {disease}")
                        print(f"Confidence: {confidence * 100:.2f}%")
                        print(f"Actual class: {class_dir}")
                        break
        
    except Exception as e:
        print(f"\n❌ Error during training: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
