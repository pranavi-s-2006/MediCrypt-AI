from transformers import TrOCRProcessor, VisionEncoderDecoderModel
from PIL import Image
import torch
import io

_processor = None
_model = None

def _load_model():
    global _processor, _model
    if _processor is None:
        _processor = TrOCRProcessor.from_pretrained("microsoft/trocr-base-handwritten")
        _model = VisionEncoderDecoderModel.from_pretrained("microsoft/trocr-base-handwritten")
        _model.eval()

async def extract_text_from_image(image_bytes: bytes) -> str:
    _load_model()
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    pixel_values = _processor(images=image, return_tensors="pt").pixel_values
    with torch.no_grad():
        generated_ids = _model.generate(pixel_values)
    return _processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
