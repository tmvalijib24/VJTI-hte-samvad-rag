from ocr_service import extract_text


text = extract_text(
    "../../images/gf.pdf"
)


print(text)