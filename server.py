# ============================================================
# AgriAI Backend Server
# ESP32 + SQLite + Gemini AI
# ============================================================

from flask import Flask, jsonify, send_from_directory, request
from flask_cors import CORS
from datetime import datetime

import random
import os
import time
import json


# ============================================================
# DATABASE
# ============================================================

from database import (
    save_sensor_reading,
    get_latest_reading,
    get_readings,
    get_total_readings
)


# ============================================================
# GEMINI AI
# ============================================================

from ai import (
    analyze_crop,
    analyze_crop_image,
    analyze_combined_crop
)


# ============================================================
# PATH CONFIGURATION
# ============================================================

BASE_DIR = os.path.dirname(
    os.path.dirname(
        os.path.abspath(__file__)
    )
)

FRONTEND_DIR = os.path.join(
    BASE_DIR,
    "frontend"
)


# ============================================================
# FLASK APPLICATION
# ============================================================

app = Flask(
    __name__,
    static_folder=FRONTEND_DIR,
    static_url_path=""
)

# Allow frontend requests
CORS(app)

# Maximum uploaded image size: 10 MB
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024


# ============================================================
# ESP32 CONNECTION STATUS
# ============================================================

esp32_last_seen = 0
esp32_ip = "Not connected"
esp32_sensor_data = None


# ============================================================
# DEMO SENSOR DATA
# ============================================================

sensor_data = {

    "moisture": 62.0,

    "temperature": 27.0,

    "humidity": 68.0,

    "nitrogen": 72.0,

    "phosphorus": 48.0,

    "potassium": 65.0

}


# ============================================================
# CONSTANTS
# ============================================================

ESP32_TIMEOUT_SECONDS = 20

AI_HISTORY_LIMIT = 20

DEFAULT_CROP = "Tomato"


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def is_esp32_connected():
    """
    Return True only when ESP32 has communicated recently.
    """

    if esp32_last_seen <= 0:
        return False

    return (
        time.time() - esp32_last_seen
    ) < ESP32_TIMEOUT_SECONDS


# ------------------------------------------------------------

def clean_sensor_data(data):
    """
    Convert sensor values to numeric values.

    Returns None when required values cannot be converted.
    """

    if not isinstance(data, dict):
        return None

    required_fields = [

        "moisture",
        "temperature",
        "humidity",
        "nitrogen",
        "phosphorus",
        "potassium"

    ]

    cleaned = {}

    for field in required_fields:

        if field not in data:
            return None

        try:

            value = float(
                data[field]
            )

        except (
            ValueError,
            TypeError
        ):

            return None

        # Prevent NaN / infinity from entering the AI request
        if not (
            float("-inf")
            <
            value
            <
            float("inf")
        ):

            return None

        cleaned[field] = value

    return cleaned


# ------------------------------------------------------------

def extract_sensor_data_from_database_reading(reading):
    """
    Convert a database reading into the standard sensor structure.
    """

    if not reading:
        return None

    return clean_sensor_data({

        "moisture":
            reading.get("moisture"),

        "temperature":
            reading.get("temperature"),

        "humidity":
            reading.get("humidity"),

        "nitrogen":
            reading.get("nitrogen"),

        "phosphorus":
            reading.get("phosphorus"),

        "potassium":
            reading.get("potassium")

    })


# ------------------------------------------------------------

def parse_json_field(value, fallback):
    """
    Safely parse JSON stored inside multipart/form-data.
    """

    if value is None:
        return fallback

    if isinstance(value, (dict, list)):
        return value

    if not isinstance(value, str):
        return fallback

    value = value.strip()

    if not value:
        return fallback

    try:

        parsed = json.loads(value)

        return parsed

    except Exception:

        return fallback


# ------------------------------------------------------------

def get_current_sensor_data():
    """
    Get the best available current sensor data.

    Priority:
        1. Live ESP32
        2. Latest database reading
        3. Demo data
    """

    if (
        is_esp32_connected()
        and esp32_sensor_data is not None
    ):

        return (
            esp32_sensor_data.copy(),
            "ESP32"
        )

    latest = get_latest_reading()

    latest_data = extract_sensor_data_from_database_reading(
        latest
    )

    if latest_data is not None:

        return (
            latest_data,
            latest.get(
                "source",
                "DATABASE"
            )
        )

    return (
        sensor_data.copy(),
        "DEMO"
    )


# ============================================================
# INITIALIZE ESP32 DATA FROM DATABASE
# ============================================================

try:

    _latest_init = get_latest_reading()

    if (
        _latest_init
        and _latest_init.get("source") == "ESP32"
    ):

        esp32_sensor_data = (
            extract_sensor_data_from_database_reading(
                _latest_init
            )
        )

        try:

            timestamp_value = (
                _latest_init.get(
                    "timestamp"
                )
            )

            if timestamp_value:

                esp32_last_seen = (
                    datetime
                    .fromisoformat(
                        timestamp_value
                    )
                    .timestamp()
                )

        except Exception:

            # Important:
            # Restored database data does not automatically
            # mean the ESP32 is currently online.
            esp32_last_seen = 0


except Exception as error:

    print(
        "ESP32 initialization warning:",
        error
    )


# ============================================================
# HEALTH CALCULATION
# ============================================================

def calculate_health(data):

    cleaned = clean_sensor_data(
        data
    )

    if cleaned is None:

        return 0

    moisture = cleaned["moisture"]

    temperature = cleaned["temperature"]

    humidity = cleaned["humidity"]

    nitrogen = cleaned["nitrogen"]

    phosphorus = cleaned["phosphorus"]

    potassium = cleaned["potassium"]


    score = 100


    # --------------------------------------------------------
    # SOIL MOISTURE
    # --------------------------------------------------------

    if moisture < 30:

        score -= 20

    elif moisture < 40:

        score -= 10

    elif moisture > 90:

        score -= 15


    # --------------------------------------------------------
    # TEMPERATURE
    # --------------------------------------------------------

    if (
        temperature < 15
        or temperature > 38
    ):

        score -= 15

    elif (
        temperature < 20
        or temperature > 34
    ):

        score -= 7


    # --------------------------------------------------------
    # HUMIDITY
    # --------------------------------------------------------

    if (
        humidity < 30
        or humidity > 90
    ):

        score -= 10

    elif (
        humidity < 40
        or humidity > 80
    ):

        score -= 5


    # --------------------------------------------------------
    # NITROGEN
    # --------------------------------------------------------

    if nitrogen < 30:

        score -= 15

    elif nitrogen < 50:

        score -= 7


    # --------------------------------------------------------
    # PHOSPHORUS
    # --------------------------------------------------------

    if phosphorus < 20:

        score -= 10

    elif phosphorus < 35:

        score -= 5


    # --------------------------------------------------------
    # POTASSIUM
    # --------------------------------------------------------

    if potassium < 30:

        score -= 10

    elif potassium < 45:

        score -= 5


    return max(
        0,
        min(
            100,
            score
        )
    )


# ============================================================
# HEALTH STATUS
# ============================================================

def get_health_status(score):

    if score >= 80:

        return "Healthy"

    if score >= 60:

        return "Moderate"

    if score >= 40:

        return "Needs Attention"

    return "Critical"


# ============================================================
# DEMO VALUE GENERATOR
# ============================================================

def random_value(
    current,
    minimum,
    maximum,
    change=1.0
):

    current += random.uniform(
        -change,
        change
    )

    current = max(
        minimum,
        current
    )

    current = min(
        maximum,
        current
    )

    return round(
        current,
        2
    )


# ============================================================
# ERROR HANDLER
# ============================================================

@app.errorhandler(413)
def request_entity_too_large(error):

    return jsonify({

        "success": False,

        "error":
            "Uploaded image is too large. Maximum size is 10 MB."

    }), 413


# ============================================================
# FRONTEND
# ============================================================

@app.route("/")
def home():

    return send_from_directory(
        FRONTEND_DIR,
        "index.html"
    )


# ============================================================
# SYSTEM STATUS
# ============================================================

@app.route("/api/status")
def system_status():

    connected = is_esp32_connected()

    return jsonify({

        "success": True,

        "server":
            "online",

        "data_source":
            "ESP32"
            if connected
            else "DEMO",

        "esp32": {

            "connected":
                connected,

            "ip":
                esp32_ip,

            "last_seen":
                esp32_last_seen

        }

    })


# ============================================================
# ESP32 HEARTBEAT
# ============================================================

@app.route(
    "/api/esp32/heartbeat",
    methods=[
        "GET",
        "POST"
    ]
)
def esp32_heartbeat():

    global esp32_last_seen
    global esp32_ip


    # --------------------------------------------------------
    # UPDATE LIVE CONNECTION
    # --------------------------------------------------------

    esp32_last_seen = time.time()


    # --------------------------------------------------------
    # STORE ESP32 IP
    # --------------------------------------------------------

    esp32_ip = (
        request.remote_addr
        or
        "Unknown"
    )


    print(
        "ESP32 heartbeat received "
        f"from {esp32_ip}"
    )


    return jsonify({

        "success":
            True,

        "message":
            "ESP32-S3 heartbeat received",

        "device":
            "ESP32-S3",

        "ip":
            esp32_ip,

        "timestamp":
            datetime.now().isoformat()

    })


# ============================================================
# ESP32 SENSOR DATA
# ============================================================

@app.route(
    "/api/esp32/sensors",
    methods=["POST"]
)
def esp32_sensors():

    global esp32_last_seen
    global esp32_ip
    global esp32_sensor_data


    # --------------------------------------------------------
    # READ JSON
    # --------------------------------------------------------

    data = request.get_json(
        silent=True
    )


    if data is None:

        return jsonify({

            "success":
                False,

            "error":
                "Invalid or missing JSON data"

        }), 400


    # --------------------------------------------------------
    # REQUIRED FIELDS
    # --------------------------------------------------------

    required_fields = [

        "moisture",
        "temperature",
        "humidity",
        "nitrogen",
        "phosphorus",
        "potassium"

    ]


    missing_fields = [

        field

        for field in required_fields

        if field not in data

    ]


    if missing_fields:

        return jsonify({

            "success":
                False,

            "error":
                "Missing sensor fields",

            "missing":
                missing_fields

        }), 400


    # --------------------------------------------------------
    # CONVERT SENSOR VALUES
    # --------------------------------------------------------

    reading = clean_sensor_data(
        data
    )


    if reading is None:

        return jsonify({

            "success":
                False,

            "error":
                "Sensor values must be valid numeric values"

        }), 400


    # --------------------------------------------------------
    # UPDATE ESP32 LIVE STATUS
    # --------------------------------------------------------

    esp32_last_seen = time.time()

    esp32_ip = (
        request.remote_addr
        or
        "Unknown"
    )

    esp32_sensor_data = (
        reading.copy()
    )


    # --------------------------------------------------------
    # SAVE TO SQLITE
    # --------------------------------------------------------

    try:

        reading_id = save_sensor_reading(

            reading,

            source="ESP32"

        )

    except Exception as error:

        print(
            "Database save error:",
            error
        )

        return jsonify({

            "success":
                False,

            "error":
                "Failed to save sensor data",

            "details":
                str(error)

        }), 500


    # --------------------------------------------------------
    # CALCULATE HEALTH
    # --------------------------------------------------------

    health_score = calculate_health(
        reading
    )

    health_status = get_health_status(
        health_score
    )


    # --------------------------------------------------------
    # CONSOLE
    # --------------------------------------------------------

    print("")
    print("========================================")
    print("ESP32-S3 SENSOR DATA")
    print("========================================")

    print(
        "Moisture    :",
        reading["moisture"]
    )

    print(
        "Temperature :",
        reading["temperature"]
    )

    print(
        "Humidity    :",
        reading["humidity"]
    )

    print(
        "Nitrogen    :",
        reading["nitrogen"]
    )

    print(
        "Phosphorus  :",
        reading["phosphorus"]
    )

    print(
        "Potassium   :",
        reading["potassium"]
    )

    print(
        "Database ID :",
        reading_id
    )

    print(
        "Health      :",
        health_score
    )

    print(
        "Status      :",
        health_status
    )

    print("========================================")
    print("")


    # --------------------------------------------------------
    # RESPONSE
    # --------------------------------------------------------

    return jsonify({

        "success":
            True,

        "message":
            "ESP32 sensor data received",

        "device":
            "ESP32-S3",

        "ip":
            esp32_ip,

        "reading_id":
            reading_id,

        "sensor_data":
            reading,

        "health_score":
            health_score,

        "health_status":
            health_status,

        "timestamp":
            datetime.now().isoformat()

    })


# ============================================================
# SENSOR DATA
# ============================================================

@app.route("/api/sensors")
def sensors():

    global sensor_data


    # --------------------------------------------------------
    # CHECK ESP32
    # --------------------------------------------------------

    connected = is_esp32_connected()


    # --------------------------------------------------------
    # LIVE ESP32 DATA
    # --------------------------------------------------------

    if (
        connected
        and esp32_sensor_data is not None
    ):

        data = (
            esp32_sensor_data.copy()
        )

        health_score = calculate_health(
            data
        )

        return jsonify({

            "success":
                True,

            "source":
                "ESP32",

            "timestamp":
                datetime.now().isoformat(),

            "data":
                data,

            "health_score":
                health_score,

            "health_status":
                get_health_status(
                    health_score
                )

        })


    # --------------------------------------------------------
    # DEMO DATA
    # --------------------------------------------------------

    sensor_data["moisture"] = random_value(

        sensor_data["moisture"],

        20,

        90,

        1.5

    )


    sensor_data["temperature"] = random_value(

        sensor_data["temperature"],

        20,

        35,

        0.4

    )


    sensor_data["humidity"] = random_value(

        sensor_data["humidity"],

        40,

        85,

        1.0

    )


    sensor_data["nitrogen"] = random_value(

        sensor_data["nitrogen"],

        30,

        100,

        2.0

    )


    sensor_data["phosphorus"] = random_value(

        sensor_data["phosphorus"],

        20,

        80,

        1.5

    )


    sensor_data["potassium"] = random_value(

        sensor_data["potassium"],

        30,

        100,

        2.0

    )


    # --------------------------------------------------------
    # SAVE DEMO READING
    # --------------------------------------------------------

    try:

        save_sensor_reading(

            sensor_data,

            source="DEMO"

        )

    except Exception as error:

        print(
            "Demo database error:",
            error
        )


    # --------------------------------------------------------
    # HEALTH
    # --------------------------------------------------------

    health_score = calculate_health(
        sensor_data
    )


    # --------------------------------------------------------
    # RESPONSE
    # --------------------------------------------------------

    return jsonify({

        "success":
            True,

        "source":
            "DEMO",

        "timestamp":
            datetime.now().isoformat(),

        "data":
            sensor_data.copy(),

        "health_score":
            health_score,

        "health_status":
            get_health_status(
                health_score
            )

    })


# ============================================================
# LATEST SENSOR READING
# ============================================================

@app.route("/api/sensors/latest")
def latest_sensor():

    latest = get_latest_reading()


    if latest is None:

        return jsonify({

            "success":
                False,

            "message":
                "No sensor data available"

        }), 404


    return jsonify({

        "success":
            True,

        "data":
            latest

    })


# ============================================================
# SENSOR HISTORY
# ============================================================

@app.route("/api/sensors/history")
def sensor_history():

    # --------------------------------------------------------
    # LIMIT
    # --------------------------------------------------------

    try:

        limit = int(
            request.args.get(
                "limit",
                100
            )
        )

    except (
        ValueError,
        TypeError
    ):

        limit = 100


    # --------------------------------------------------------
    # OFFSET
    # --------------------------------------------------------

    try:

        offset = int(
            request.args.get(
                "offset",
                0
            )
        )

    except (
        ValueError,
        TypeError
    ):

        offset = 0


    # --------------------------------------------------------
    # SAFETY LIMIT
    # --------------------------------------------------------

    limit = max(
        1,
        min(
            limit,
            1000
        )
    )


    offset = max(
        0,
        offset
    )


    # --------------------------------------------------------
    # FILTERS
    # --------------------------------------------------------

    selected_date = request.args.get(
        "date",
        ""
    ).strip()


    start_time = request.args.get(
        "start_time",
        ""
    ).strip()


    end_time = request.args.get(
        "end_time",
        ""
    ).strip()


    # --------------------------------------------------------
    # VALIDATE DATE
    # --------------------------------------------------------

    if selected_date:

        try:

            datetime.strptime(
                selected_date,
                "%Y-%m-%d"
            )

        except ValueError:

            return jsonify({

                "success":
                    False,

                "error":
                    "Invalid date format. Use YYYY-MM-DD."

            }), 400


    # --------------------------------------------------------
    # VALIDATE TIME
    # --------------------------------------------------------

    def valid_time(value):

        if not value:
            return True

        try:

            datetime.strptime(
                value,
                "%H:%M"
            )

            return True

        except ValueError:

            return False


    if not valid_time(start_time):

        return jsonify({

            "success":
                False,

            "error":
                "Invalid start time. Use HH:MM."

        }), 400


    if not valid_time(end_time):

        return jsonify({

            "success":
                False,

            "error":
                "Invalid end time. Use HH:MM."

        }), 400


    # --------------------------------------------------------
    # VALIDATE TIME RANGE
    # --------------------------------------------------------

    if (
        start_time
        and end_time
        and start_time > end_time
    ):

        return jsonify({

            "success":
                False,

            "error":
                "Start time cannot be later than end time."

        }), 400


    # --------------------------------------------------------
    # GET REQUESTED READINGS
    # --------------------------------------------------------

    readings = get_readings(

        limit=limit,

        selected_date=(

            selected_date

            if selected_date

            else None

        ),

        start_time=(

            start_time

            if start_time

            else None

        ),

        end_time=(

            end_time

            if end_time

            else None

        ),

        offset=offset

    )


    # --------------------------------------------------------
    # TOTAL DATABASE COUNT
    # --------------------------------------------------------

    total_count = get_total_readings()


    # --------------------------------------------------------
    # FILTERED COUNT
    # --------------------------------------------------------

    filtered_count = total_count


    if (
        selected_date
        or start_time
        or end_time
    ):

        filtered_readings = get_readings(

            limit=1000000,

            selected_date=(

                selected_date

                if selected_date

                else None

            ),

            start_time=(

                start_time

                if start_time

                else None

            ),

            end_time=(

                end_time

                if end_time

                else None

            ),

            offset=0

        )


        filtered_count = len(
            filtered_readings
        )


    # --------------------------------------------------------
    # PAGINATION
    # --------------------------------------------------------

    next_offset = (
        offset
        +
        len(readings)
    )


    has_more = (
        next_offset
        <
        filtered_count
    )


    # --------------------------------------------------------
    # CONSOLE
    # --------------------------------------------------------

    print(
        "History request:",
        "limit=",
        limit,
        "offset=",
        offset,
        "date=",
        selected_date,
        "start=",
        start_time,
        "end=",
        end_time
    )


    print(
        "History:",
        len(readings),
        "returned /",
        filtered_count,
        "matching /",
        total_count,
        "total"
    )


    # --------------------------------------------------------
    # RESPONSE
    # --------------------------------------------------------

    return jsonify({

        "success":
            True,

        "count":
            len(readings),

        "total_count":
            total_count,

        "filtered_count":
            filtered_count,

        "limit":
            limit,

        "offset":
            offset,

        "next_offset":
            next_offset,

        "has_more":
            has_more,

        "data":
            readings

    })


# ============================================================
# CROP HEALTH
# ============================================================

@app.route("/api/health")
def health():

    data, source = get_current_sensor_data()


    score = calculate_health(
        data
    )


    status = get_health_status(
        score
    )


    return jsonify({

        "success":
            True,

        "source":
            source,

        "health_score":
            score,

        "status":
            status,

        "sensor_data":
            data,

        "timestamp":
            datetime.now().isoformat()

    })


# ============================================================
# CROP HEALTH ALIAS
# ============================================================

@app.route("/api/crop-health")
def crop_health():

    data, source = get_current_sensor_data()


    score = calculate_health(
        data
    )


    status = get_health_status(
        score
    )


    moisture = float(
        data.get(
            "moisture",
            0
        )
    )


    if 40 <= moisture <= 80:

        moisture_status = "Optimal"

    else:

        moisture_status = "Needs Attention"


    return jsonify({

        "success":
            True,

        "source":
            source,

        "health_score":
            score,

        "status":
            status,

        "sensor_data":
            data,

        "health": {

            "moisture_status":
                moisture_status

        },

        "timestamp":
            datetime.now().isoformat()

    })


# ============================================================
# SENSOR AI ANALYSIS
# ============================================================

@app.route(
    "/api/ai/analyze",
    methods=["POST"]
)
def ai_analyze():

    try:

        # ====================================================
        # DEFAULT VALUES
        # ====================================================

        crop = DEFAULT_CROP

        data = None

        historical = []

        image_bytes = None

        mime_type = None

        filename = None


        # ====================================================
        # DETECT MULTIPART REQUEST
        # ====================================================

        is_multipart = (
            request.content_type
            and
            request.content_type.startswith(
                "multipart/form-data"
            )
        )


        # ====================================================
        # MULTIPART REQUEST
        #
        # This is the new frontend format.
        #
        # It can contain:
        #   crop
        #   sensor_data
        #   historical_readings
        #   image
        # ====================================================

        if is_multipart:

            crop = request.form.get(
                "crop",
                DEFAULT_CROP
            ).strip()


            if not crop:

                crop = DEFAULT_CROP


            # ------------------------------------------------
            # SENSOR DATA
            # ------------------------------------------------

            sensor_json = request.form.get(
                "sensor_data",
                ""
            )


            parsed_sensor = parse_json_field(
                sensor_json,
                None
            )


            if isinstance(
                parsed_sensor,
                dict
            ):

                data = clean_sensor_data(
                    parsed_sensor
                )


            # ------------------------------------------------
            # HISTORICAL DATA
            # ------------------------------------------------

            history_json = request.form.get(
                "historical_readings",
                ""
            )


            parsed_history = parse_json_field(
                history_json,
                []
            )


            if isinstance(
                parsed_history,
                list
            ):

                historical = (
                    parsed_history[
                        :AI_HISTORY_LIMIT
                    ]
                )

            else:

                historical = []


            # ------------------------------------------------
            # IMAGE
            # ------------------------------------------------

            image = request.files.get(
                "image"
            )


            if image is not None:

                filename = (
                    image.filename
                    or
                    "uploaded_image"
                )


                # --------------------------------------------
                # MIME TYPE
                # --------------------------------------------

                mime_type = (
                    image.mimetype
                    or
                    ""
                )


                if not mime_type.startswith(
                    "image/"
                ):

                    return jsonify({

                        "success":
                            False,

                        "error":
                            "Uploaded file must be an image."

                    }), 400


                # --------------------------------------------
                # READ IMAGE
                # --------------------------------------------

                image_bytes = image.read()


                if not image_bytes:

                    return jsonify({

                        "success":
                            False,

                        "error":
                            "Uploaded image is empty."

                    }), 400


        # ====================================================
        # JSON REQUEST
        #
        # Backward compatibility with the previous frontend.
        # ====================================================

        else:

            payload = (
                request.get_json(
                    silent=True
                )
                or
                {}
            )


            crop = str(
                payload.get(
                    "crop",
                    DEFAULT_CROP
                )
            ).strip()


            if not crop:

                crop = DEFAULT_CROP


            parsed_sensor = payload.get(
                "sensor_data"
            )


            if isinstance(
                parsed_sensor,
                dict
            ):

                data = clean_sensor_data(
                    parsed_sensor
                )


            parsed_history = payload.get(
                "historical_readings"
            )


            if isinstance(
                parsed_history,
                list
            ):

                historical = (
                    parsed_history[
                        :AI_HISTORY_LIMIT
                    ]
                )


        # ====================================================
        # FALLBACK TO CURRENT SENSOR DATA
        # ====================================================

        if data is None:

            data, data_source = (
                get_current_sensor_data()
            )

        else:

            data_source = "REQUEST"


        # ====================================================
        # CONSOLE LOG
        # ====================================================

        print("")
        print("========================================")
        print("SENSOR + IMAGE AI ANALYSIS")
        print("========================================")

        print(
            "Crop:",
            crop
        )

        print(
            "Sensor source:",
            data_source
        )

        print(
            "Sensor data:",
            data
        )

        print(
            "History:",
            len(historical)
        )

        print(
            "Image:",
            filename
            if filename
            else "None"
        )

        print(
            "Image used:",
            bool(image_bytes)
        )

        print("========================================")
        print("")


        # ====================================================
        # GEMINI
        # ====================================================

        analysis = analyze_crop(

            crop_type=crop,

            sensor_data=data,

            historical_readings=historical,

            image_bytes=image_bytes,

            mime_type=mime_type

        )


        # ====================================================
        # RESPONSE
        # ====================================================

        return jsonify({

            "success":
                True,

            "crop":
                crop,

            "image_used":
                bool(image_bytes),

            "filename":
                filename,

            "historical_count":
                len(historical),

            "sensor_source":
                data_source,

            "analysis":
                analysis

        })


    except Exception as error:

        print("")
        print("========================================")
        print("SENSOR AI ERROR")
        print("========================================")
        print(
            repr(error)
        )
        print("========================================")
        print("")


        return jsonify({

            "success":
                False,

            "error":
                str(error)

        }), 500


# ============================================================
# CROP IMAGE AI
# ============================================================

@app.route(
    "/api/ai/image",
    methods=["POST"]
)
def ai_image():

    try:

        # ----------------------------------------------------
        # CROP
        # ----------------------------------------------------

        crop = request.form.get(
            "crop",
            DEFAULT_CROP
        ).strip()


        if not crop:

            crop = DEFAULT_CROP


        # ----------------------------------------------------
        # IMAGE
        # ----------------------------------------------------

        image = request.files.get(
            "image"
        )


        # ----------------------------------------------------
        # CHECK IMAGE
        # ----------------------------------------------------

        if image is None:

            return jsonify({

                "success":
                    False,

                "error":
                    "No image was uploaded."

            }), 400


        # ----------------------------------------------------
        # MIME TYPE
        # ----------------------------------------------------

        mime_type = (
            image.mimetype
            or
            ""
        )


        if not mime_type.startswith(
            "image/"
        ):

            return jsonify({

                "success":
                    False,

                "error":
                    "Uploaded file must be an image."

            }), 400


        # ----------------------------------------------------
        # READ IMAGE
        # ----------------------------------------------------

        image_bytes = image.read()


        if not image_bytes:

            return jsonify({

                "success":
                    False,

                "error":
                    "Uploaded image is empty."

            }), 400


        # ----------------------------------------------------
        # CONSOLE
        # ----------------------------------------------------

        print("")
        print("========================================")
        print("CROP IMAGE AI ANALYSIS")
        print("========================================")

        print(
            "Crop:",
            crop
        )

        print(
            "Image:",
            image.filename
        )

        print(
            "Image type:",
            mime_type
        )

        print(
            "Image size:",
            len(image_bytes),
            "bytes"
        )

        print("========================================")
        print("")


        # ----------------------------------------------------
        # GEMINI IMAGE ANALYSIS
        # ----------------------------------------------------

        analysis = analyze_crop_image(

            crop_type=crop,

            image_bytes=image_bytes,

            mime_type=mime_type

        )


        # ----------------------------------------------------
        # RESPONSE
        # ----------------------------------------------------

        return jsonify({

            "success":
                True,

            "crop":
                crop,

            "filename":
                image.filename,

            "image_used":
                True,

            "analysis":
                analysis

        })


    except Exception as error:

        print("")
        print("========================================")
        print("IMAGE AI ERROR")
        print("========================================")

        print(
            repr(error)
        )

        print("========================================")
        print("")


        return jsonify({

            "success":
                False,

            "error":
                str(error)

        }), 500


# ============================================================
# COMBINED AI ANALYSIS
# ============================================================

@app.route(
    "/api/ai/combined",
    methods=["POST"]
)
def ai_combined():

    try:

        # ----------------------------------------------------
        # CROP
        # ----------------------------------------------------

        crop_type = request.form.get(
            "crop",
            DEFAULT_CROP
        ).strip()


        if not crop_type:

            crop_type = DEFAULT_CROP


        # ----------------------------------------------------
        # IMAGE
        # ----------------------------------------------------

        image = request.files.get(
            "image"
        )


        # ----------------------------------------------------
        # SENSOR DATA FROM FRONTEND
        #
        # The frontend may send the currently displayed
        # sensor values.
        # ----------------------------------------------------

        sensor_json = request.form.get(
            "sensor_data",
            ""
        )


        submitted_sensor = parse_json_field(
            sensor_json,
            None
        )


        submitted_sensor = (
            clean_sensor_data(
                submitted_sensor
            )
            if isinstance(
                submitted_sensor,
                dict
            )
            else None
        )


        # ----------------------------------------------------
        # DATABASE LATEST READING
        # ----------------------------------------------------

        latest = get_latest_reading()


        # ----------------------------------------------------
        # SELECT LATEST SENSOR DATA
        #
        # Priority:
        #   1. Frontend submitted sensor data
        #   2. Latest database reading
        #   3. Demo data
        # ----------------------------------------------------

        if submitted_sensor is not None:

            latest_sensor_reading = {

                "timestamp":
                    datetime.now().isoformat(),

                "moisture":
                    submitted_sensor[
                        "moisture"
                    ],

                "temperature":
                    submitted_sensor[
                        "temperature"
                    ],

                "humidity":
                    submitted_sensor[
                        "humidity"
                    ],

                "nitrogen":
                    submitted_sensor[
                        "nitrogen"
                    ],

                "phosphorus":
                    submitted_sensor[
                        "phosphorus"
                    ],

                "potassium":
                    submitted_sensor[
                        "potassium"
                    ],

                "source":
                    "REQUEST"

            }


        elif latest is not None:

            latest_sensor_reading = latest


        else:

            latest_sensor_reading = {

                "timestamp":
                    None,

                "moisture":
                    sensor_data[
                        "moisture"
                    ],

                "temperature":
                    sensor_data[
                        "temperature"
                    ],

                "humidity":
                    sensor_data[
                        "humidity"
                    ],

                "nitrogen":
                    sensor_data[
                        "nitrogen"
                    ],

                "phosphorus":
                    sensor_data[
                        "phosphorus"
                    ],

                "potassium":
                    sensor_data[
                        "potassium"
                    ],

                "source":
                    "DEMO"

            }


        # ----------------------------------------------------
        # HISTORICAL READINGS
        #
        # Use frontend history if supplied.
        # Otherwise use database history.
        # ----------------------------------------------------

        history_json = request.form.get(
            "historical_readings",
            ""
        )


        submitted_history = parse_json_field(
            history_json,
            None
        )


        if isinstance(
            submitted_history,
            list
        ) and submitted_history:

            historical = (
                submitted_history[
                    :AI_HISTORY_LIMIT
                ]
            )

        else:

            historical = get_readings(
                limit=AI_HISTORY_LIMIT
            )


        # ----------------------------------------------------
        # IMAGE VARIABLES
        # ----------------------------------------------------

        image_bytes = None

        mime_type = None

        filename = None


        # ----------------------------------------------------
        # PROCESS IMAGE
        # ----------------------------------------------------

        if image is not None:

            filename = (
                image.filename
                or
                "uploaded_image"
            )


            mime_type = (
                image.mimetype
                or
                ""
            )


            if not mime_type.startswith(
                "image/"
            ):

                return jsonify({

                    "success":
                        False,

                    "error":
                        "Uploaded file must be an image."

                }), 400


            image_bytes = image.read()


            if not image_bytes:

                return jsonify({

                    "success":
                        False,

                    "error":
                        "Uploaded image is empty."

                }), 400


        # ----------------------------------------------------
        # CONSOLE
        # ----------------------------------------------------

        print("")
        print("========================================")
        print("COMBINED AI ANALYSIS REQUEST")
        print("========================================")

        print(
            "Crop:",
            crop_type
        )

        print(
            "Latest sensor reading:",
            latest_sensor_reading
        )

        print(
            "Historical readings:",
            len(historical)
        )

        print(
            "Image:",
            filename
            if filename
            else "None"
        )

        print(
            "Image used:",
            bool(image_bytes)
        )

        print("========================================")
        print("")


        # ----------------------------------------------------
        # GEMINI COMBINED ANALYSIS
        # ----------------------------------------------------

        result = analyze_combined_crop(

            crop_type=crop_type,

            latest_reading=latest_sensor_reading,

            historical_readings=historical,

            image_bytes=image_bytes,

            mime_type=mime_type

        )


        # ----------------------------------------------------
        # RESPONSE
        # ----------------------------------------------------

        return jsonify({

            "success":
                True,

            "crop":
                crop_type,

            "image_used":
                image_bytes is not None,

            "filename":
                filename,

            "historical_count":
                len(historical),

            "analysis":
                result

        })


    except Exception as error:

        print("")
        print("========================================")
        print("COMBINED AI ERROR")
        print("========================================")

        print(
            repr(error)
        )

        print("========================================")
        print("")


        return jsonify({

            "success":
                False,

            "error":
                str(error)

        }), 500


# ============================================================
# DATABASE STATISTICS
# ============================================================

@app.route("/api/database/stats")
def database_stats():

    try:

        total = get_total_readings()

        latest = get_latest_reading()


        return jsonify({

            "success":
                True,

            "total_readings":
                total,

            "latest_reading":
                latest

        })


    except Exception as error:

        print(
            "Database statistics error:",
            error
        )


        return jsonify({

            "success":
                False,

            "error":
                str(error)

        }), 500


# ============================================================
# API HEALTH CHECK
# ============================================================

@app.route("/api/healthcheck")
def healthcheck():

    database_status = "connected"


    try:

        get_total_readings()

    except Exception:

        database_status = "error"


    return jsonify({

        "success":
            True,

        "server":
            "online",

        "database":
            database_status,

        "esp32_connected":
            is_esp32_connected(),

        "timestamp":
            datetime.now().isoformat()

    })


# ============================================================
# 404 HANDLER
# ============================================================

@app.errorhandler(404)
def not_found(error):

    # For API requests, return JSON.
    if request.path.startswith("/api/"):

        return jsonify({

            "success":
                False,

            "error":
                "API endpoint not found",

            "path":
                request.path

        }), 404


    # Otherwise try to serve the frontend.
    try:

        return send_from_directory(
            FRONTEND_DIR,
            "index.html"
        )

    except Exception:

        return jsonify({

            "success":
                False,

            "error":
                "Page not found"

        }), 404


# ============================================================
# GENERAL ERROR HANDLER
# ============================================================

@app.errorhandler(500)
def internal_server_error(error):

    print(
        "Internal server error:",
        error
    )


    return jsonify({

        "success":
            False,

        "error":
            "Internal server error"

    }), 500


# ============================================================
# RUN SERVER
# ============================================================

if __name__ == "__main__":

    print("")
    print("========================================")
    print("        AgriAI Backend Server")
    print("========================================")

    print(
        "Dashboard:",
        "http://127.0.0.1:5000"
    )

    print(
        "Network:",
        "http://10.80.79.156:5000"
    )

    print(
        "ESP32 heartbeat:",
        "/api/esp32/heartbeat"
    )

    print(
        "ESP32 sensors:",
        "/api/esp32/sensors"
    )

    print(
        "Latest sensor:",
        "/api/sensors/latest"
    )

    print(
        "History:",
        "/api/sensors/history"
    )

    print(
        "Database stats:",
        "/api/database/stats"
    )

    print(
        "Health:",
        "/api/health"
    )

    print(
        "Sensor AI:",
        "/api/ai/analyze"
    )

    print(
        "Image AI:",
        "/api/ai/image"
    )

    print(
        "Combined AI:",
        "/api/ai/combined"
    )

    print("========================================")
    print("")

    app.run(

        host="0.0.0.0",

        port=5000,

        debug=False

    )