import qrcode
import os
from config import settings


def generate_emergency_qr(patient_id: str, scan_base_url: str) -> str:
    """
    Generate a QR code that contains ONLY the scan URL.
    The URL points to GET /emergency/scan/{patient_id} — a public endpoint
    that returns only the minimum life-saving data.

    No raw patient data is stored in the QR code itself.
    """
    scan_url = f"{scan_base_url.rstrip('/')}/emergency/scan/{patient_id}"

    qr = qrcode.QRCode(
        version=2,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    qr.add_data(scan_url)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")

    out_dir = settings.QR_OUTPUT_DIR
    os.makedirs(out_dir, exist_ok=True)
    file_path = os.path.join(out_dir, f"{patient_id}_emergency.png")
    img.save(file_path)
    return file_path
