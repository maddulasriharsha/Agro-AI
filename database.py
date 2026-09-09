import sqlite3
from pathlib import Path
from datetime import datetime


# ============================================================
# AGRIAI DATABASE CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent

DATABASE_DIR = BASE_DIR / "database"

DATABASE_DIR.mkdir(
    exist_ok=True
)

DATABASE_PATH = DATABASE_DIR / "agriai.db"


# ============================================================
# DATABASE CONNECTION
# ============================================================

def get_connection():

    connection = sqlite3.connect(
        DATABASE_PATH
    )

    connection.row_factory = sqlite3.Row

    return connection


# ============================================================
# INITIALIZE DATABASE
# ============================================================

def initialize_database():

    connection = get_connection()

    cursor = connection.cursor()


    # --------------------------------------------------------
    # Sensor readings table
    # --------------------------------------------------------

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sensor_readings (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            timestamp TEXT NOT NULL,

            moisture REAL NOT NULL,

            temperature REAL NOT NULL,

            humidity REAL NOT NULL,

            nitrogen REAL NOT NULL,

            phosphorus REAL NOT NULL,

            potassium REAL NOT NULL,

            source TEXT NOT NULL

        )
    """)


    # --------------------------------------------------------
    # IMPORTANT
    #
    # These indexes make history searches much faster when
    # thousands or millions of readings are stored.
    # --------------------------------------------------------

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS
        idx_sensor_timestamp
        ON sensor_readings(timestamp)
    """)


    cursor.execute("""
        CREATE INDEX IF NOT EXISTS
        idx_sensor_source
        ON sensor_readings(source)
    """)


    connection.commit()

    connection.close()


# ============================================================
# SAVE SENSOR READING
# ============================================================

def save_sensor_reading(
    data,
    source="demo"
):

    connection = get_connection()

    cursor = connection.cursor()


    timestamp = datetime.now().isoformat()


    cursor.execute("""
        INSERT INTO sensor_readings (

            timestamp,

            moisture,

            temperature,

            humidity,

            nitrogen,

            phosphorus,

            potassium,

            source

        )

        VALUES (?, ?, ?, ?, ?, ?, ?, ?)

    """, (

        timestamp,

        float(
            data["moisture"]
        ),

        float(
            data["temperature"]
        ),

        float(
            data["humidity"]
        ),

        float(
            data["nitrogen"]
        ),

        float(
            data["phosphorus"]
        ),

        float(
            data["potassium"]
        ),

        source

    ))


    connection.commit()


    reading_id = cursor.lastrowid


    connection.close()


    return reading_id


# ============================================================
# GET LATEST READING
# ============================================================

def get_latest_reading():

    connection = get_connection()

    cursor = connection.cursor()


    cursor.execute("""
        SELECT *

        FROM sensor_readings

        ORDER BY id DESC

        LIMIT 1
    """)


    row = cursor.fetchone()


    connection.close()


    if row is None:

        return None


    return dict(row)


# ============================================================
# GET TOTAL NUMBER OF READINGS
#
# IMPORTANT:
# This returns the REAL database count.
# It is NOT limited to 50, 100, or 500.
# ============================================================

def get_total_readings():

    connection = get_connection()

    cursor = connection.cursor()


    cursor.execute("""
        SELECT COUNT(*)

        FROM sensor_readings
    """)


    result = cursor.fetchone()


    connection.close()


    if result is None:

        return 0


    return int(
        result[0]
    )


# ============================================================
# GET SENSOR READINGS
#
# This function DOES NOT delete or limit stored data.
#
# "limit" only controls how many rows are returned to the
# dashboard at one time.
# ============================================================

def get_readings(

    limit=100,

    selected_date=None,

    start_time=None,

    end_time=None,

    offset=0

):

    connection = get_connection()

    cursor = connection.cursor()


    # --------------------------------------------------------
    # Safety values
    # --------------------------------------------------------

    try:

        limit = int(
            limit
        )

    except (
        ValueError,
        TypeError
    ):

        limit = 100


    try:

        offset = int(
            offset
        )

    except (
        ValueError,
        TypeError
    ):

        offset = 0


    limit = max(
        1,
        limit
    )


    offset = max(
        0,
        offset
    )


    # --------------------------------------------------------
    # Base query
    # --------------------------------------------------------

    query = """
        SELECT

            id,

            timestamp,

            moisture,

            temperature,

            humidity,

            nitrogen,

            phosphorus,

            potassium,

            source

        FROM sensor_readings
    """


    conditions = []

    parameters = []


    # --------------------------------------------------------
    # DATE FILTER
    # --------------------------------------------------------

    if selected_date:

        conditions.append(
            "timestamp >= ?"
        )

        parameters.append(
            selected_date +
            "T00:00:00"
        )


        conditions.append(
            "timestamp < ?"
        )

        parameters.append(
            selected_date +
            "T23:59:59.999999"
        )


    # --------------------------------------------------------
    # START TIME
    # --------------------------------------------------------

    if (
        selected_date
        and start_time
    ):

        conditions.append(
            "timestamp >= ?"
        )

        parameters.append(
            selected_date +
            "T" +
            start_time +
            ":00"
        )


    # --------------------------------------------------------
    # END TIME
    # --------------------------------------------------------

    if (
        selected_date
        and end_time
    ):

        conditions.append(
            "timestamp <= ?"
        )

        parameters.append(
            selected_date +
            "T" +
            end_time +
            ":59.999999"
        )


    # --------------------------------------------------------
    # Apply filters
    # --------------------------------------------------------

    if conditions:

        query += (
            " WHERE "
            +
            " AND ".join(
                conditions
            )
        )


    # --------------------------------------------------------
    # Latest readings first
    # --------------------------------------------------------

    query += """

        ORDER BY timestamp DESC

        LIMIT ?

        OFFSET ?

    """


    parameters.append(
        limit
    )

    parameters.append(
        offset
    )


    cursor.execute(
        query,
        parameters
    )


    rows = cursor.fetchall()


    connection.close()


    # --------------------------------------------------------
    # Convert rows to dictionaries
    # --------------------------------------------------------

    readings = []


    for row in rows:

        readings.append({

            "id":
                row["id"],

            "timestamp":
                row["timestamp"],

            "moisture":
                row["moisture"],

            "temperature":
                row["temperature"],

            "humidity":
                row["humidity"],

            "nitrogen":
                row["nitrogen"],

            "phosphorus":
                row["phosphorus"],

            "potassium":
                row["potassium"],

            "source":
                row["source"]

        })


    return readings


# ============================================================
# INITIALIZE DATABASE WHEN MODULE LOADS
# ============================================================

initialize_database()