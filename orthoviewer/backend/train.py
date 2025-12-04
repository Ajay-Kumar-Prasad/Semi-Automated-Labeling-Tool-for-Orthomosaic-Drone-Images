# train.py
# Usage example:
# python train.py --images_dir ./images --masks_dir ./masks --out model_rf.joblib

import os
import argparse
import numpy as np
from joblib import dump
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from tqdm import tqdm
from PIL import Image
from orthoviewer.backend.helpers import compute_superpixels, extract_features_for_labels

def load_image(path):
    img = Image.open(path).convert("RGB")
    return np.array(img)

def load_mask(path):
    """
    Expect label mask where pixel values are {0,1,2} representing classes.
    Masks must align exactly with orthomosaic.
    """
    m = Image.open(path)
    return np.array(m)

def build_dataset(images_dir, masks_dir, n_segments=2000, compactness=10):
    X_list = []
    y_list = []
    file_pairs = []
    for fname in os.listdir(images_dir):
        img_path = os.path.join(images_dir, fname)
        mask_path = os.path.join(masks_dir, fname)  # assume same filename for mask
        if not os.path.exists(mask_path):
            print(f"Skipping {fname}: no mask at {mask_path}")
            continue
        img = load_image(img_path)
        mask = load_mask(mask_path)
        if img.shape[:2] != mask.shape[:2]:
            print(f"Skipping {fname}: shape mismatch between image and mask")
            continue

        labels_map = compute_superpixels(img, n_segments=n_segments, compactness=compactness)
        features, sp_ids = extract_features_for_labels(img, labels_map)

        # build label per superpixel as majority vote from mask
        # flatten
        flat_sp = labels_map.reshape(-1)
        flat_mask = mask.reshape(-1)
        num_sp = sp_ids.max() + 1
        counts = np.zeros((num_sp, 3), dtype=np.int32)  # assuming 3 classes
        for i in range(flat_sp.shape[0]):
            l = flat_sp[i]
            lab = int(flat_mask[i])
            if lab < 0 or lab > 2:
                continue
            counts[l, lab] += 1
        # majority
        sp_labels = counts.argmax(axis=1)
        # filter empty superpixels (if any have count 0)
        valid = (counts.sum(axis=1) > 0)
        features_valid = features[valid]
        labels_valid = sp_labels[valid]

        X_list.append(features_valid)
        y_list.append(labels_valid)
        file_pairs.append((img_path, mask_path))

    if len(X_list) == 0:
        raise ValueError("No training data found. Check paths and masks.")

    X = np.vstack(X_list)
    y = np.hstack(y_list)
    return X, y

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--images_dir", required=True)
    p.add_argument("--masks_dir", required=True)
    p.add_argument("--out", default="model_rf.joblib")
    p.add_argument("--n_segments", type=int, default=2000)
    p.add_argument("--compactness", type=float, default=10.0)
    p.add_argument("--test_size", type=float, default=0.2)
    args = p.parse_args()

    print("Building dataset...")
    X, y = build_dataset(args.images_dir, args.masks_dir, n_segments=args.n_segments, compactness=args.compactness)
    print(f"Dataset size: X={X.shape}, y={y.shape}")

    X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=args.test_size, random_state=42, stratify=y)
    print("Training RandomForest...")
    clf = RandomForestClassifier(n_estimators=200, n_jobs=-1, random_state=42)
    clf.fit(X_train, y_train)
    print("Evaluating...")
    acc = clf.score(X_val, y_val)
    print(f"Validation accuracy: {acc:.4f}")

    dump(clf, args.out)
    print(f"Model saved to {args.out}")

if __name__ == "__main__":
    main()
