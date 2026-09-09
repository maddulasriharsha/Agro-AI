#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClient.h>
#include <Wire.h>

#include <Adafruit_GFX.h>
#include <Adafruit_SH110X.h>
#include <DHT.h>


// =========================================================
// AGRIAI ESP32-S3 SENSOR NODE
// =========================================================
//
// CURRENT HARDWARE:
//
// 1. ESP32-S3 N16R8
// 2. Capacitive Soil Moisture Sensor
// 3. DHT11 Temperature + Humidity Sensor
// 4. 0.96" 128x64 I2C OLED
//
// NOT CONNECTED YET:
//
// 5. MAX485
// 6. RS485 NPK Sensor
//
// =========================================================


// =========================================================
// PIN CONFIGURATION
// =========================================================

// ---------------------------------------------------------
// I2C BUS
// ---------------------------------------------------------
//
// OLED SDA -> GPIO 8
// OLED SCL -> GPIO 9
//
// ---------------------------------------------------------

#define I2C_SDA 8
#define I2C_SCL 9


// ---------------------------------------------------------
// SOIL MOISTURE SENSOR
// ---------------------------------------------------------
//
// Sensor AOUT -> GPIO 4
//
// ---------------------------------------------------------

#define SOIL_MOISTURE_PIN 4


// ---------------------------------------------------------
// DHT11 TEMPERATURE + HUMIDITY SENSOR
// ---------------------------------------------------------
//
// DHT DATA -> GPIO 7
//
// ---------------------------------------------------------

#define DHT_PIN 7
#define DHT_TYPE DHT11

DHT dht(DHT_PIN, DHT_TYPE);


// =========================================================
// OLED CONFIGURATION
// =========================================================

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64

#define OLED_RESET -1
#define OLED_ADDRESS 0x3C

Adafruit_SH1106G display(
    SCREEN_WIDTH,
    SCREEN_HEIGHT,
    &Wire,
    OLED_RESET
);

bool oledReady = false;


// =========================================================
// WIFI CONFIGURATION
// =========================================================

const char* ssid = "JioFiber-Harsha";

// IMPORTANT:
// Put your Wi-Fi password here.
const char* password = "Harsha@2275";


// =========================================================
// FLASK SERVER
// =========================================================

const char* serverIP = "192.168.29.123";

const int serverPort = 5000;


const char* sensorURL =
    "http://192.168.29.123:5000/api/esp32/sensors";


const char* heartbeatURL =
    "http://192.168.29.123:5000/api/esp32/heartbeat";


// =========================================================
// TIMING
// =========================================================

unsigned long lastSendTime = 0;

const unsigned long sendInterval = 5000;


// =========================================================
// SOIL MOISTURE CALIBRATION
// =========================================================
//
// IMPORTANT:
//
// These are STARTING values.
//
// We will calibrate these using YOUR sensor.
//
// Higher raw ADC value = usually drier
// Lower raw ADC value  = usually wetter
//
// Example:
//
// Dry = 3000
// Wet = 1300
//
// 3000 -> 0%
// 2150 -> 50%
// 1300 -> 100%
//
// =========================================================

#define SOIL_DRY_VALUE 3000
#define SOIL_WET_VALUE 1300


// Number of readings averaged together
#define SOIL_SAMPLES 10


// =========================================================
// SENSOR VARIABLES
// =========================================================

float temperature = 0.0;
float humidity = 0.0;

int soilRaw = 0;
float soilMoisture = 0.0;


// =========================================================
// NPK VARIABLES
// =========================================================
//
// NPK is NOT connected yet.
//
// These are placeholders.
//
// Later, when MAX485 + NPK are connected,
// these will contain real readings.
//
// =========================================================

float nitrogen = 0.0;
float phosphorus = 0.0;
float potassium = 0.0;


// =========================================================
// STATUS
// =========================================================

int lastHeartbeatCode = 0;
int lastSensorCode = 0;


// =========================================================
// FUNCTION DECLARATIONS
// =========================================================

void initDisplay();

void showStatus(
    String line1,
    String line2,
    String line3
);

void showSensorReadings();

void readDHT11();

void readSoilMoisture();

int readSoilAverage();

float calculateSoilPercentage(
    int rawValue
);

void printSensorData();

void sendHeartbeat();

void sendSensorData();

void testRawConnection();


// =========================================================
// OLED INITIALIZATION
// =========================================================

void initDisplay()
{
    Serial.println();
    Serial.println("Initializing I2C bus...");

    Wire.begin(
        I2C_SDA,
        I2C_SCL
    );

    delay(100);

    Serial.print("I2C SDA: GPIO ");
    Serial.println(I2C_SDA);

    Serial.print("I2C SCL: GPIO ");
    Serial.println(I2C_SCL);


    Serial.println();
    Serial.println("Initializing OLED...");


    if (!display.begin(
            OLED_ADDRESS,
            true
        ))
    {
        Serial.println("OLED init FAILED.");
        Serial.println("Check OLED wiring/address.");

        oledReady = false;

        return;
    }


    oledReady = true;

    Serial.println(
        "OLED detected successfully."
    );


    display.clearDisplay();

    display.setTextColor(
        SH110X_WHITE
    );

    display.setTextSize(1);


    // Frame

    display.drawRect(
        0,
        0,
        SCREEN_WIDTH,
        SCREEN_HEIGHT,
        SH110X_WHITE
    );


    // Title

    display.setCursor(
        6,
        4
    );

    display.print(
        "AgriAI ESP32-S3"
    );


    display.drawFastHLine(
        3,
        15,
        SCREEN_WIDTH - 6,
        SH110X_WHITE
    );


    display.setCursor(
        6,
        28
    );

    display.print(
        "Initializing..."
    );


    display.display();

    delay(1000);
}


// =========================================================
// OLED STATUS SCREEN
// =========================================================

void showStatus(
    String line1,
    String line2,
    String line3
)
{
    if (!oledReady)
    {
        return;
    }


    display.clearDisplay();

    display.setTextSize(1);

    display.setTextColor(
        SH110X_WHITE
    );


    // Frame

    display.drawRect(
        0,
        0,
        SCREEN_WIDTH,
        SCREEN_HEIGHT,
        SH110X_WHITE
    );


    // Title

    display.setCursor(
        6,
        4
    );

    display.print(
        "AgriAI ESP32-S3"
    );


    display.drawFastHLine(
        3,
        15,
        SCREEN_WIDTH - 6,
        SH110X_WHITE
    );


    // Status lines

    display.setCursor(
        6,
        24
    );

    display.print(
        line1
    );


    display.setCursor(
        6,
        36
    );

    display.print(
        line2
    );


    display.setCursor(
        6,
        48
    );

    display.print(
        line3
    );


    display.display();
}


// =========================================================
// READ DHT11
// =========================================================

void readDHT11()
{
    // Read humidity

    float newHumidity =
        dht.readHumidity();


    // Read temperature

    float newTemperature =
        dht.readTemperature();


    // Check whether reading failed

    if (
        isnan(newHumidity) ||
        isnan(newTemperature)
    )
    {
        Serial.println(
            "WARNING: DHT11 reading failed."
        );

        Serial.println(
            "Check VCC, GND and DATA wiring."
        );

        return;
    }


    humidity = newHumidity;

    temperature = newTemperature;


    Serial.println(
        "DHT11 reading successful."
    );
}


// =========================================================
// READ SOIL MOISTURE
// =========================================================

void readSoilMoisture()
{
    soilRaw =
        readSoilAverage();


    soilMoisture =
        calculateSoilPercentage(
            soilRaw
        );


    // Keep percentage between 0 and 100

    if (soilMoisture < 0)
    {
        soilMoisture = 0;
    }


    if (soilMoisture > 100)
    {
        soilMoisture = 100;
    }
}


// =========================================================
// AVERAGE SOIL ADC
// =========================================================

int readSoilAverage()
{
    long total = 0;


    for (
        int i = 0;
        i < SOIL_SAMPLES;
        i++
    )
    {
        total +=
            analogRead(
                SOIL_MOISTURE_PIN
            );


        delay(5);
    }


    return total / SOIL_SAMPLES;
}


// =========================================================
// SOIL ADC -> PERCENTAGE
// =========================================================

float calculateSoilPercentage(
    int rawValue
)
{
    float percentage =
        (
            (
                float(
                    SOIL_DRY_VALUE
                    -
                    rawValue
                )
            )
            /
            (
                float(
                    SOIL_DRY_VALUE
                    -
                    SOIL_WET_VALUE
                )
            )
        )
        * 100.0;


    return percentage;
}


// =========================================================
// OLED SENSOR SCREEN
// =========================================================

void showSensorReadings()
{
    if (!oledReady)
    {
        return;
    }


    bool wifiOK =
        (
            WiFi.status()
            ==
            WL_CONNECTED
        );


    display.clearDisplay();

    display.setTextSize(1);

    display.setTextColor(
        SH110X_WHITE
    );


    // Frame

    display.drawRect(
        0,
        0,
        SCREEN_WIDTH,
        SCREEN_HEIGHT,
        SH110X_WHITE
    );


    // Title

    display.setCursor(
        6,
        4
    );

    display.print(
        "AgriAI Live"
    );


    // Wi-Fi indicator

    if (wifiOK)
    {
        display.fillCircle(
            119,
            7,
            3,
            SH110X_WHITE
        );
    }
    else
    {
        display.drawCircle(
            119,
            7,
            3,
            SH110X_WHITE
        );
    }


    display.drawFastHLine(
        3,
        15,
        SCREEN_WIDTH - 6,
        SH110X_WHITE
    );


    // -------------------------------------------------------
    // Temperature
    // -------------------------------------------------------

    display.setCursor(
        6,
        21
    );

    display.print(
        "Temp:"
    );

    display.print(
        temperature,
        1
    );

    display.print(
        " C"
    );


    // -------------------------------------------------------
    // Humidity
    // -------------------------------------------------------

    display.setCursor(
        70,
        21
    );

    display.print(
        "Hum:"
    );

    display.print(
        humidity,
        1
    );

    display.print(
        "%"
    );


    // -------------------------------------------------------
    // Soil moisture
    // -------------------------------------------------------

    display.setCursor(
        6,
        33
    );

    display.print(
        "Soil:"
    );

    display.print(
        soilMoisture,
        1
    );

    display.print(
        "%"
    );


    // -------------------------------------------------------
    // Raw ADC
    // -------------------------------------------------------

    display.setCursor(
        70,
        33
    );

    display.print(
        "ADC:"
    );

    display.print(
        soilRaw
    );


    // -------------------------------------------------------
    // NPK status
    // -------------------------------------------------------

    display.setCursor(
        6,
        45
    );

    display.print(
        "NPK: NOT CONNECTED"
    );


    // -------------------------------------------------------
    // Footer
    // -------------------------------------------------------

    display.drawFastHLine(
        3,
        53,
        SCREEN_WIDTH - 6,
        SH110X_WHITE
    );


    display.setCursor(
        6,
        56
    );

    display.print(
        "HB:"
    );

    display.print(
        lastHeartbeatCode
    );

    display.print(
        " TX:"
    );

    display.print(
        lastSensorCode
    );


    display.display();
}


// =========================================================
// SERIAL SENSOR OUTPUT
// =========================================================

void printSensorData()
{
    Serial.println();
    Serial.println(
        "========================================"
    );

    Serial.println(
        "       CURRENT SENSOR READINGS"
    );

    Serial.println(
        "========================================"
    );


    // Temperature

    Serial.print(
        "Temperature : "
    );

    Serial.print(
        temperature,
        2
    );

    Serial.println(
        " °C"
    );


    // Humidity

    Serial.print(
        "Humidity    : "
    );

    Serial.print(
        humidity,
        2
    );

    Serial.println(
        " %"
    );


    // Soil raw

    Serial.print(
        "Soil Raw    : "
    );

    Serial.println(
        soilRaw
    );


    // Soil percentage

    Serial.print(
        "Soil Moist. : "
    );

    Serial.print(
        soilMoisture,
        1
    );

    Serial.println(
        " %"
    );


    // NPK

    Serial.println(
        "Nitrogen    : NOT CONNECTED"
    );

    Serial.println(
        "Phosphorus  : NOT CONNECTED"
    );

    Serial.println(
        "Potassium   : NOT CONNECTED"
    );


    Serial.println(
        "========================================"
    );
}


// =========================================================
// RAW TCP CONNECTION TEST
// =========================================================

void testRawConnection()
{
    Serial.println();

    Serial.println(
        "========================================"
    );

    Serial.println(
        "      RAW TCP CONNECTION TEST"
    );

    Serial.println(
        "========================================"
    );


    Serial.print(
        "Target: "
    );

    Serial.print(
        serverIP
    );

    Serial.print(
        ":"
    );

    Serial.println(
        serverPort
    );


    WiFiClient client;


    Serial.println(
        "Attempting TCP connection..."
    );


    if (
        client.connect(
            serverIP,
            serverPort
        )
    )
    {
        Serial.println(
            "SUCCESS: TCP connection established!"
        );

        Serial.println(
            "Flask port 5000 is reachable."
        );


        client.stop();
    }
    else
    {
        Serial.println(
            "FAILED: TCP connection refused."
        );

        Serial.println(
            "ESP32 cannot reach Flask."
        );
    }


    Serial.println(
        "========================================"
    );
}


// =========================================================
// SEND HEARTBEAT
// =========================================================

void sendHeartbeat()
{
    if (
        WiFi.status()
        !=
        WL_CONNECTED
    )
    {
        Serial.println(
            "Heartbeat skipped: Wi-Fi disconnected."
        );

        return;
    }


    HTTPClient http;


    Serial.println();
    Serial.println(
        "Sending heartbeat..."
    );


    if (
        !http.begin(
            heartbeatURL
        )
    )
    {
        Serial.println(
            "HTTP begin failed for heartbeat."
        );

        return;
    }


    http.setTimeout(
        5000
    );


    http.addHeader(
        "Content-Type",
        "application/json"
    );


    String data =
        "{\"device\":\"ESP32-S3\",\"status\":\"online\"}";


    int code =
        http.POST(
            data
        );


    lastHeartbeatCode =
        code;


    Serial.print(
        "Heartbeat HTTP Code: "
    );

    Serial.println(
        code
    );


    if (code > 0)
    {
        String response =
            http.getString();


        Serial.print(
            "Heartbeat Response: "
        );

        Serial.println(
            response
        );
    }
    else
    {
        Serial.print(
            "Heartbeat Error: "
        );

        Serial.println(
            http.errorToString(
                code
            )
        );
    }


    http.end();
}


// =========================================================
// SEND SENSOR DATA
// =========================================================

void sendSensorData()
{
    // =====================================================
    // READ REAL HARDWARE
    // =====================================================

    readDHT11();

    readSoilMoisture();


    // =====================================================
    // NPK PLACEHOLDERS
    // =====================================================

    nitrogen = 0.0;

    phosphorus = 0.0;

    potassium = 0.0;


    // =====================================================
    // SERIAL OUTPUT
    // =====================================================

    printSensorData();


    // =====================================================
    // UPDATE OLED
    // =====================================================

    showSensorReadings();


    // =====================================================
    // IF WIFI IS NOT CONNECTED, STOP HERE
    // =====================================================

    if (
        WiFi.status()
        !=
        WL_CONNECTED
    )
    {
        Serial.println(
            "Sensor data not sent: Wi-Fi disconnected."
        );

        return;
    }


    // =====================================================
    // BUILD JSON
    // =====================================================

    String jsonData = "{";


    jsonData +=
        "\"moisture\":";

    jsonData +=
        String(
            soilMoisture,
            1
        );

    jsonData += ",";


    jsonData +=
        "\"temperature\":";

    jsonData +=
        String(
            temperature,
            1
        );

    jsonData += ",";


    jsonData +=
        "\"humidity\":";

    jsonData +=
        String(
            humidity,
            1
        );

    jsonData += ",";


    jsonData +=
        "\"nitrogen\":";

    jsonData +=
        String(
            nitrogen,
            1
        );

    jsonData += ",";


    jsonData +=
        "\"phosphorus\":";

    jsonData +=
        String(
            phosphorus,
            1
        );

    jsonData += ",";


    jsonData +=
        "\"potassium\":";

    jsonData +=
        String(
            potassium,
            1
        );


    jsonData += "}";


    Serial.println();

    Serial.println(
        "JSON SENT TO FLASK:"
    );

    Serial.println(
        jsonData
    );


    // =====================================================
    // HTTP
    // =====================================================

    HTTPClient http;


    if (
        !http.begin(
            sensorURL
        )
    )
    {
        Serial.println(
            "HTTP begin failed for sensor data."
        );

        return;
    }


    http.setTimeout(
        5000
    );


    http.addHeader(
        "Content-Type",
        "application/json"
    );


    // =====================================================
    // POST
    // =====================================================

    int code =
        http.POST(
            jsonData
        );


    lastSensorCode =
        code;


    Serial.print(
        "Sensor HTTP Response Code: "
    );

    Serial.println(
        code
    );


    // =====================================================
    // FLASK RESPONSE
    // =====================================================

    if (code > 0)
    {
        String response =
            http.getString();


        Serial.println(
            "Flask Response:"
        );

        Serial.println(
            response
        );
    }
    else
    {
        Serial.print(
            "HTTP Error: "
        );

        Serial.println(
            http.errorToString(
                code
            )
        );
    }


    http.end();


    // Update OLED again so TX code is visible

    showSensorReadings();


    Serial.println();
}


// =========================================================
// SETUP
// =========================================================

void setup()
{
    Serial.begin(
        115200
    );


    delay(
        2000
    );


    Serial.println();

    Serial.println(
        "========================================"
    );

    Serial.println(
        "        AgriAI ESP32-S3"
    );

    Serial.println(
        "========================================"
    );


    // =====================================================
    // I2C + OLED
    // =====================================================

    initDisplay();


    // =====================================================
    // DHT11
    // =====================================================

    Serial.println();

    Serial.println(
        "Initializing DHT11..."
    );


    dht.begin();


    delay(2000);


    Serial.println(
        "DHT11 initialized."
    );


    Serial.print(
        "DHT DATA pin: GPIO "
    );

    Serial.println(
        DHT_PIN
    );


    // =====================================================
    // SOIL SENSOR
    // =====================================================

    Serial.println();

    Serial.println(
        "Initializing soil moisture sensor..."
    );


    pinMode(
        SOIL_MOISTURE_PIN,
        INPUT
    );


    // ESP32-S3 ADC resolution

    analogReadResolution(
        12
    );


    Serial.print(
        "Soil ADC pin: GPIO "
    );

    Serial.println(
        SOIL_MOISTURE_PIN
    );


    // =====================================================
    // WIFI
    // =====================================================

    Serial.println();

    Serial.println(
        "Connecting to Wi-Fi..."
    );


    WiFi.mode(
        WIFI_STA
    );


    WiFi.begin(
        ssid,
        password
    );


    Serial.print(
        "Connecting"
    );


    showStatus(
        "Connecting to",
        "Wi-Fi...",
        ""
    );


    int attempts = 0;


    while (
        WiFi.status()
        !=
        WL_CONNECTED
        &&
        attempts < 40
    )
    {
        delay(
            500
        );


        Serial.print(
            "."
        );


        attempts++;
    }


    Serial.println();


    // =====================================================
    // WIFI RESULT
    // =====================================================

    if (
        WiFi.status()
        ==
        WL_CONNECTED
    )
    {
        Serial.println(
            "Wi-Fi Connected"
        );


        Serial.print(
            "ESP32 IP Address: "
        );

        Serial.println(
            WiFi.localIP()
        );


        Serial.print(
            "Signal Strength: "
        );

        Serial.print(
            WiFi.RSSI()
        );

        Serial.println(
            " dBm"
        );


        showStatus(
            "WiFi Connected",
            "IP: " + WiFi.localIP().toString(),
            "Server: " + String(serverIP)
        );
    }
    else
    {
        Serial.println(
            "Wi-Fi connection failed."
        );


        showStatus(
            "WiFi FAILED",
            "Check SSID/",
            "password"
        );
    }


    // =====================================================
    // FLASK SERVER
    // =====================================================

    Serial.println();

    Serial.println(
        "Flask Server:"
    );


    Serial.print(
        "http://"
    );

    Serial.print(
        serverIP
    );

    Serial.print(
        ":"
    );

    Serial.println(
        serverPort
    );


    Serial.println(
        "========================================"
    );


    // =====================================================
    // TCP TEST
    // =====================================================

    if (
        WiFi.status()
        ==
        WL_CONNECTED
    )
    {
        testRawConnection();
    }


    // =====================================================
    // INITIAL SENSOR READING
    // =====================================================

    readDHT11();

    readSoilMoisture();


    showSensorReadings();


    printSensorData();
}


// =========================================================
// MAIN LOOP
// =========================================================

void loop()
{
    // =====================================================
    // CHECK WIFI
    // =====================================================

    if (
        WiFi.status()
        !=
        WL_CONNECTED
    )
    {
        Serial.println(
            "Wi-Fi disconnected. Reconnecting..."
        );


        showStatus(
            "WiFi Disconnected",
            "Reconnecting...",
            ""
        );


        WiFi.disconnect();


        delay(
            500
        );


        WiFi.begin(
            ssid,
            password
        );


        delay(
            3000
        );


        return;
    }


    // =====================================================
    // SEND DATA EVERY 5 SECONDS
    // =====================================================

    unsigned long currentTime =
        millis();


    if (
        currentTime - lastSendTime
        >=
        sendInterval
    )
    {
        lastSendTime =
            currentTime;


        // -------------------------------------------------
        // HEARTBEAT
        // -------------------------------------------------

        sendHeartbeat();


        delay(
            100
        );


        // -------------------------------------------------
        // SENSOR DATA
        // -------------------------------------------------

        sendSensorData();
    }


    delay(10);
}