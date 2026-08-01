"""
Reusable speech-to-text service built on Faster-Whisper.

Supports:
    - English
    - Marathi
    - Automatic language detection

Exposes:
    transcribe_audio(audio_path: str) -> dict

The Faster-Whisper model is loaded once (singleton)
and reused across requests. Uses CPU inference with
int8 quantization for efficient offline transcription.
"""

import logging
import os
import time
from threading import Lock

logger = logging.getLogger(__name__)

# Supported audio extensions for validation
AUDIO_EXTENSIONS = {".wav", ".mp3", ".m4a", ".ogg", ".webm"}

# ---------------------------------------------------------
# Singleton Faster-Whisper instance
# ---------------------------------------------------------

_whisper_model = None
_whisper_lock = Lock()


def _get_whisper_model():
    """
    Initialize the Faster-Whisper model once and reuse it.

    Uses the 'small' model with CPU inference and int8
    quantization by default. Override with environment
    variables WHISPER_MODEL_SIZE and WHISPER_COMPUTE_TYPE.
    """

    global _whisper_model

    if _whisper_model is not None:
        return _whisper_model

    with _whisper_lock:

        if _whisper_model is not None:
            return _whisper_model

        model_size = os.getenv("WHISPER_MODEL_SIZE", "small").strip()
        compute_type = os.getenv("WHISPER_COMPUTE_TYPE", "int8").strip()

        logger.info(
            "Initializing Faster-Whisper model (size=%s, device=cpu, compute_type=%s)...",
            model_size,
            compute_type,
        )

        from faster_whisper import WhisperModel

        _whisper_model = WhisperModel(
            model_size,
            device="cpu",
            compute_type=compute_type,
        )

        logger.info("Faster-Whisper model loaded successfully.")

        return _whisper_model


# ---------------------------------------------------------
# Public transcription function
# ---------------------------------------------------------


def transcribe_audio(audio_path: str) -> dict:
    """
    Transcribe an audio file to text.

    Args:
        audio_path:
            Path to the audio file (.wav, .mp3, .m4a, .ogg, .webm)

    Returns:
        dict with keys:
            - text (str): The transcribed text
            - language (str): Detected language code (e.g. "en", "mr")
            - duration_seconds (float): Time taken for transcription

    Raises:
        FileNotFoundError: If the audio file does not exist
        ValueError: If the file format is unsupported or no speech detected
        RuntimeError: If transcription fails
    """

    # Validate file exists
    if not os.path.isfile(audio_path):
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    # Validate extension
    _, ext = os.path.splitext(audio_path.lower())

    if ext not in AUDIO_EXTENSIONS:
        raise ValueError(
            f"Unsupported audio format: {ext}. "
            f"Supported: {', '.join(sorted(AUDIO_EXTENSIONS))}"
        )

    logger.info("Starting transcription for %s", audio_path)

    model = _get_whisper_model()

    start_time = time.time()

    try:
        segments, info = model.transcribe(
            audio_path,
            beam_size=5,
            # Let Faster-Whisper auto-detect between English and Marathi
            language=None,
            vad_filter=True,
            vad_parameters=dict(
                min_silence_duration_ms=500,
            ),
        )

        # Collect all segment texts
        text_parts = []
        for segment in segments:
            text_parts.append(segment.text.strip())

        transcribed_text = " ".join(text_parts).strip()

    except Exception as exc:
        logger.exception("Transcription failed for %s", audio_path)
        raise RuntimeError(f"Transcription failed: {exc}") from exc

    elapsed = round(time.time() - start_time, 2)
    detected_language = getattr(info, "language", "unknown")
    language_probability = getattr(info, "language_probability", 0.0)

    # Clean up repeated whitespace
    while "  " in transcribed_text:
        transcribed_text = transcribed_text.replace("  ", " ")

    logger.info(
        "Transcription completed. Language=%s (prob=%.2f), "
        "Duration=%.2fs, Characters=%d",
        detected_language,
        language_probability,
        elapsed,
        len(transcribed_text),
    )

    if not transcribed_text:
        raise ValueError("No speech detected in the audio file.")

    return {
        "text": transcribed_text,
        "language": detected_language,
        "duration_seconds": elapsed,
    }
