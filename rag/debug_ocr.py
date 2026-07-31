"""Quick diagnostic to see PaddleOCR 3.x result structure."""
import os
import sys
import glob

os.environ["FLAGS_use_mkldnn"] = "0"

from paddleocr import PaddleOCR

ocr = PaddleOCR(lang="en", enable_mkldnn=False)

# Find a test image in storage/uploads
test_images = glob.glob("storage/uploads/*.png")
if not test_images:
    print("No PNG files found in storage/uploads/")
    sys.exit(1)

img = test_images[0]
print(f"Testing with: {img}\n")

result = ocr.ocr(img)
print(f"type(result) = {type(result)}")
print(f"len(result) = {len(result) if result else 'None/empty'}")

if result:
    for i, page in enumerate(result):
        print(f"\n--- page[{i}] ---")
        print(f"  type(page) = {type(page)}")
        print(f"  dir(page)  = {[a for a in dir(page) if not a.startswith('_')]}")
        
        # Try to iterate
        try:
            items = list(page) if hasattr(page, '__iter__') else [page]
            print(f"  len(items) = {len(items)}")
            for j, det in enumerate(items[:3]):  # first 3 detections
                print(f"\n  det[{j}]:")
                print(f"    type     = {type(det)}")
                print(f"    repr     = {repr(det)[:200]}")
                if hasattr(det, '__dict__'):
                    print(f"    __dict__ = {det.__dict__}")
                if hasattr(det, 'keys'):
                    print(f"    keys     = {list(det.keys())}")
                for attr in ['text', 'rec_text', 'rec_texts', 'bbox', 'boxes',
                             'dt_polys', 'rec_score', 'score', 'confidence']:
                    if hasattr(det, attr):
                        val = getattr(det, attr)
                        print(f"    .{attr} = {repr(val)[:150]}")
        except Exception as e:
            print(f"  iteration error: {e}")
        
        # Also try dict-like access
        if hasattr(page, 'keys'):
            print(f"  page.keys() = {list(page.keys())}")
        if hasattr(page, '__dict__'):
            print(f"  page.__dict__ keys = {list(page.__dict__.keys())}")
        for attr in ['rec_text', 'rec_texts', 'dt_polys', 'boxes', 'texts',
                     'rec_scores', 'scores', 'result', 'res']:
            if hasattr(page, attr):
                val = getattr(page, attr)
                print(f"  page.{attr} = {repr(val)[:200]}")
