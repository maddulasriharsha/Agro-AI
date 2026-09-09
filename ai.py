import os
import json
import base64
import re

from google import genai


# ============================================================
# GEMINI CONFIGURATION
# ============================================================

GEMINI_API_KEY = (
    os.getenv("GEMINI_API_KEY", "")
    .strip()
    .strip('"')
    .strip("'")
)

MODEL_NAME = "gemini-3.7-flash"

client = None

if GEMINI_API_KEY:
    client = genai.Client(
        api_key=GEMINI_API_KEY
    )


# ============================================================
# BASIC HELPERS
# ============================================================

def require_client():

    if client is None:

        raise RuntimeError(
            "GEMINI_API_KEY is not configured. "
            "Set the GEMINI_API_KEY environment variable "
            "and restart the Flask server."
        )


def clean_json_text(text):

    if not text:
        return "{}"

    text = str(text).strip()

    # Remove markdown JSON fences
    text = re.sub(
        r"^```json\s*",
        "",
        text,
        flags=re.IGNORECASE
    )

    text = re.sub(
        r"^```\s*",
        "",
        text
    )

    text = re.sub(
        r"\s*```$",
        "",
        text
    )

    # Find JSON object
    start = text.find("{")
    end = text.rfind("}")

    if (
        start != -1
        and end != -1
        and end > start
    ):

        text = text[start:end + 1]

    return text.strip()


def parse_json_response(text):

    cleaned = clean_json_text(text)

    try:

        result = json.loads(
            cleaned
        )

        if not isinstance(
            result,
            dict
        ):

            raise ValueError(
                "Gemini returned non-object JSON."
            )

        return result

    except Exception:

        return {

            "overall_health_score": None,

            "overall_status":
                "Analysis Available",

            "sensor_health_score":
                None,

            "image_health_score":
                None,

            "stress_level":
                "Unknown",

            "plant_condition":
                "Unable to determine",

            "summary":
                text or
                "Gemini returned an unreadable response.",

            "soil_moisture_status":
                "Unable to determine",

            "temperature_status":
                "Unable to determine",

            "humidity_status":
                "Unable to determine",

            "nutrient_status":
                "Unable to determine",

            "water_need":
                "Unable to determine",

            "water_recommendation":
                "Review the sensor readings.",

            "nutrient_recommendation":
                "Review the NPK readings.",

            "visual_observations":
                [],

            "possible_concerns":
                [],

            "actions":
                [],

            "confidence":
                "Low"

        }


def get_output_text(interaction):

    text = getattr(
        interaction,
        "output_text",
        None
    )

    if text:

        return text

    try:

        for step in reversed(
            interaction.steps
        ):

            if getattr(
                step,
                "type",
                None
            ) == "model_output":

                content = getattr(
                    step,
                    "content",
                    []
                )

                parts = []

                for block in content:

                    block_text = getattr(
                        block,
                        "text",
                        None
                    )

                    if block_text:

                        parts.append(
                            block_text
                        )

                if parts:

                    return "\n".join(
                        parts
                    )

    except Exception:

        pass

    return ""


def normalize_score(
    value
):

    if value is None:
        return None

    try:

        return max(
            0,
            min(
                100,
                round(
                    float(value)
                )
            )
        )

    except (
        ValueError,
        TypeError
    ):

        return None


def normalize_list(
    value
):

    if isinstance(
        value,
        list
    ):

        return [
            str(item)
            for item in value
            if item is not None
        ]

    if value is None:

        return []

    return [
        str(value)
    ]


def normalize_analysis(
    result
):

    if not isinstance(
        result,
        dict
    ):

        result = {}

    result[
        "overall_health_score"
    ] = normalize_score(
        result.get(
            "overall_health_score"
        )
    )

    result[
        "sensor_health_score"
    ] = normalize_score(
        result.get(
            "sensor_health_score"
        )
    )

    result[
        "image_health_score"
    ] = normalize_score(
        result.get(
            "image_health_score"
        )
    )

    result[
        "visual_observations"
    ] = normalize_list(
        result.get(
            "visual_observations"
        )
    )

    result[
        "possible_concerns"
    ] = normalize_list(
        result.get(
            "possible_concerns"
        )
    )

    result[
        "actions"
    ] = normalize_list(
        result.get(
            "actions"
        )
    )

    return result


def make_image_block(
    image_bytes,
    mime_type
):

    if not image_bytes:
        return None

    if not mime_type:
        return None

    image_base64 = (
        base64.b64encode(
            image_bytes
        ).decode("utf-8")
    )

    return {

        "type":
            "image",

        "data":
            image_base64,

        "mime_type":
            mime_type

    }


def call_gemini(
    input_blocks
):

    require_client()

    try:

        interaction = client.interactions.create(

            model=MODEL_NAME,

            input=input_blocks

        )

        output = get_output_text(
            interaction
        )

        if not output:

            raise RuntimeError(
                "Gemini returned an empty response."
            )

        return normalize_analysis(
            parse_json_response(
                output
            )
        )

    except Exception as error:

        error_text = str(error)

        if (
            "API_KEY_INVALID"
            in error_text
            or
            "API key not valid"
            in error_text
            or
            "invalid api key"
            in error_text.lower()
        ):

            raise RuntimeError(
                "Gemini rejected the API key. "
                "Create a new Gemini API key in Google AI Studio, "
                "set it as GEMINI_API_KEY, then completely restart "
                "the Flask server."
            ) from error

        raise


# ============================================================
# NORMAL SENSOR + IMAGE AI
# ============================================================

def analyze_crop(
    crop_type,
    sensor_data,
    historical_readings=None,
    image_bytes=None,
    mime_type=None
):

    historical_readings = (
        historical_readings
        or []
    )

    image_available = bool(
        image_bytes
        and mime_type
    )

    prompt = f"""
You are the agricultural intelligence engine
for an experimental AgriAI crop monitoring system.

Perform a detailed crop-health assessment.

CROP:
{crop_type}

CURRENT SENSOR DATA:
{json.dumps(
    sensor_data,
    indent=2,
    default=str
)}

RECENT SENSOR HISTORY:
{json.dumps(
    historical_readings,
    indent=2,
    default=str
)}

IMAGE PROVIDED:
{"YES" if image_available else "NO"}

Your job is to combine the available sensor information
and the uploaded crop image when an image is provided.

IMAGE ANALYSIS REQUIREMENTS:

If an image is provided, carefully inspect it for visible:

- Leaf color
- Yellowing
- Browning
- Spots
- Lesions
- Wilting
- Curling
- Holes
- Chewing damage
- Necrosis
- Chlorosis
- Discoloration
- Leaf texture
- Visible pest-like damage
- Overall vigor
- Plant density or visible growth condition
- Any obvious environmental stress signs

Do NOT invent anything that cannot be seen.

If the image does not clearly show the whole plant,
state that the visual assessment is limited.

IMPORTANT:

- This is an experimental agricultural monitoring system.
- Do not claim a definitive disease diagnosis.
- Use phrases such as "possible", "consistent with",
  "may indicate", or "could be associated with".
- Do not invent sensor values.
- Do not invent historical values.
- Treat N/P/K values as sensor measurements, not laboratory
  soil-test results.
- Use the crop type when interpreting conditions.
- Use history to identify trends when useful.
- Give practical, cautious recommendations.
- Return ONLY valid JSON.
- Do not use markdown.
- Do not write anything outside the JSON object.

Return EXACTLY this JSON structure:

{{
    "overall_health_score": 0,
    "overall_status": "",
    "sensor_health_score": 0,
    "image_health_score": null,

    "stress_level": "",

    "plant_condition": "",

    "summary": "",

    "soil_moisture_status": "",
    "temperature_status": "",
    "humidity_status": "",
    "nutrient_status": "",

    "water_need": "",
    "water_recommendation": "",

    "nutrient_recommendation": "",

    "visual_observations": [],

    "possible_concerns": [],

    "actions": [],

    "confidence": ""
}}

SCORING:

overall_health_score:
0-39 = Critical
40-59 = Needs Attention
60-79 = Moderate
80-100 = Healthy

sensor_health_score:
Score the current sensor/environment condition.

image_health_score:
Score visible plant condition from the image.
Use null when no image is supplied.

The visual_observations array should contain
specific observations from the uploaded image when
an image is available.

The possible_concerns array should contain possible
stress, disease-like, nutrient-related or pest-related
concerns, but never claim certainty.

The actions array should contain practical next steps.
"""


    input_blocks = [

        {
            "type":
                "text",

            "text":
                prompt

        }

    ]


    image_block = make_image_block(
        image_bytes,
        mime_type
    )


    if image_block:

        input_blocks.append(
            image_block
        )


    return call_gemini(
        input_blocks
    )


# ============================================================
# IMAGE-ONLY AI
# ============================================================

def analyze_crop_image(
    crop_type,
    image_bytes,
    mime_type
):

    prompt = f"""
You are an agricultural crop-image analysis assistant.

Analyze the uploaded crop image carefully.

EXPECTED CROP:
{crop_type}

Inspect the image for visible:

- Plant condition
- Leaf color
- Yellowing
- Browning
- Spots
- Lesions
- Wilting
- Curling
- Holes
- Chewing damage
- Chlorosis
- Necrosis
- Visible pest-like damage
- Leaf texture
- General vigor
- Signs of water stress
- Signs that may be associated with nutrient stress
- Other visible abnormalities

IMPORTANT:

- This is a prototype.
- Do not claim a definitive disease diagnosis.
- Describe only what can reasonably be seen.
- If something is uncertain, say so.
- If the image is blurry, poorly framed or insufficient,
  explicitly mention that.
- Do not invent symptoms.
- Return ONLY valid JSON.
- Do not use markdown.
- Do not include text outside the JSON object.

Return:

{{
    "plant_condition": "",
    "stress_level": "",
    "image_health_score": 0,
    "summary": "",
    "visual_observations": [],
    "possible_concerns": [],
    "actions": [],
    "confidence": ""
}}

The image_health_score must be between 0 and 100.
"""


    image_block = make_image_block(
        image_bytes,
        mime_type
    )


    input_blocks = [

        {
            "type":
                "text",

            "text":
                prompt

        }

    ]


    if image_block:

        input_blocks.append(
            image_block
        )


    return call_gemini(
        input_blocks
    )


# ============================================================
# FULL COMBINED AI
# ============================================================

def analyze_combined_crop(
    crop_type,
    latest_reading,
    historical_readings=None,
    image_bytes=None,
    mime_type=None
):

    historical_readings = (
        historical_readings
        or []
    )

    image_available = bool(
        image_bytes
        and mime_type
    )

    prompt = f"""
You are the MAIN agricultural intelligence engine
for an experimental AgriAI crop monitoring system.

Perform a complete multimodal crop-health assessment.

You have four information sources:

1. Crop type
2. Current sensor readings
3. Recent historical sensor readings
4. Uploaded crop image

==================================================
CROP
==================================================

{crop_type}

==================================================
CURRENT SENSOR READING
==================================================

{json.dumps(
    latest_reading,
    indent=2,
    default=str
)}

==================================================
RECENT HISTORY
==================================================

{json.dumps(
    historical_readings,
    indent=2,
    default=str
)}

==================================================
IMAGE
==================================================

{"AN IMAGE HAS BEEN PROVIDED. YOU MUST ANALYZE IT." if image_available else "NO IMAGE HAS BEEN PROVIDED."}

If an image is provided, visually inspect it carefully.

Look for:

- Leaf color
- Yellowing
- Browning
- Spots
- Lesions
- Wilting
- Curling
- Holes
- Chewing damage
- Chlorosis
- Necrosis
- Visible pest-like damage
- Leaf texture
- Plant vigor
- Water-stress indicators
- Possible nutrient-stress indicators
- Other visible abnormalities

Do not invent observations.

==================================================
HISTORICAL TREND ANALYSIS
==================================================

Use the recent history to determine whether:

- Moisture is rising or falling
- Temperature is changing
- Humidity is changing
- N/P/K are changing
- Conditions are becoming more stable
- Conditions are becoming more stressful

Do not claim a trend if the data does not support one.

==================================================
IMPORTANT SAFETY / ACCURACY RULES
==================================================

- This is an experimental monitoring system.
- Do not provide a definitive disease diagnosis.
- Do not claim certainty from an image alone.
- Use cautious agricultural language.
- Do not invent sensor values.
- Do not invent historical values.
- Treat N/P/K as sensor measurements.
- Do not present them as laboratory soil-test results.
- If the image is unclear, state that confidence is limited.
- If no image exists, image_health_score must be null.
- Use the crop type when interpreting conditions.
- Provide practical recommendations.
- Return ONLY valid JSON.
- Do not use markdown.
- Do not include explanations outside JSON.

==================================================
RETURN EXACTLY THIS JSON
==================================================

{{
    "overall_health_score": 0,
    "overall_status": "",

    "sensor_health_score": 0,
    "image_health_score": null,

    "stress_level": "",

    "plant_condition": "",

    "summary": "",

    "soil_moisture_status": "",
    "temperature_status": "",
    "humidity_status": "",
    "nutrient_status": "",

    "water_need": "",
    "water_recommendation": "",

    "nutrient_recommendation": "",

    "visual_observations": [],

    "possible_concerns": [],

    "actions": [],

    "confidence": ""
}}

==================================================
SCORING
==================================================

overall_health_score:
0-39 = Critical
40-59 = Needs Attention
60-79 = Moderate
80-100 = Healthy

sensor_health_score:
Evaluate sensor/environment condition.

image_health_score:
Evaluate visible plant condition.
Use null if no image is provided.

visual_observations:
Specific things visibly seen in the image.

possible_concerns:
Possible issues only. Never claim definitive diagnosis.

actions:
Concrete recommended next steps.

confidence:
Explain whether the assessment is High, Medium or Low
and why.
"""


    input_blocks = [

        {
            "type":
                "text",

            "text":
                prompt

        }

    ]


    image_block = make_image_block(
        image_bytes,
        mime_type
    )


    if image_block:

        input_blocks.append(
            image_block
        )


    result = call_gemini(
        input_blocks
    )


    # Make sure combined analysis always has
    # the expected fields.

    defaults = {

        "overall_health_score":
            None,

        "overall_status":
            "Analysis Available",

        "sensor_health_score":
            None,

        "image_health_score":
            None,

        "stress_level":
            "Unknown",

        "plant_condition":
            "Unable to determine",

        "summary":
            "No summary returned.",

        "soil_moisture_status":
            "Unknown",

        "temperature_status":
            "Unknown",

        "humidity_status":
            "Unknown",

        "nutrient_status":
            "Unknown",

        "water_need":
            "Unknown",

        "water_recommendation":
            "Review sensor readings.",

        "nutrient_recommendation":
            "Review NPK readings.",

        "visual_observations":
            [],

        "possible_concerns":
            [],

        "actions":
            [],

        "confidence":
            "Low"

    }


    for key, default in defaults.items():

        if (
            key not in result
            or
            result[key] is None
        ):

            if (
                key == "image_health_score"
                and
                image_available
            ):

                # Keep None if Gemini could not
                # confidently score the image.

                continue

            result[key] = default


    if not image_available:

        result[
            "image_health_score"
        ] = None


    return normalize_analysis(
        result
    )