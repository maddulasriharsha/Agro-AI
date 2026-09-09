// ============================================================
// AgriAI Dashboard
// Complete Frontend JavaScript
// Smart Alerts + Irrigation Recommendation
// ============================================================

const API_BASE = "";


// ============================================================
// GLOBAL DATA
// ============================================================

let sensorData = {
    moisture: 0,
    temperature: 0,
    humidity: 0,
    nitrogen: 0,
    phosphorus: 0,
    potassium: 0
};

let sensorReady = false;

let historyData = [];

let selectedCropImageFile = null;

let combinedAIResult = null;

let healthAnalysis = null;

let environmentChart = null;

let npkChart = null;

let historyEnvironmentChart = null;

let historyNpkChart = null;


// ============================================================
// HISTORY STATE
// ============================================================

const HISTORY_PAGE_SIZE = 100;

let historyPage = 1;

let historyOffset = 0;

let historyTotalCount = 0;

let historyFilteredCount = 0;

let historyHasMore = false;

let historyNextOffset = 100;

let historyLoading = false;

let historySelectedDate = "";

let historyStartTime = "";

let historyEndTime = "";


// ============================================================
// DEVICE STATE
// ============================================================

let esp32Connected = false;

let esp32IP = null;


// ============================================================
// SMART MONITORING STATE
// ============================================================

let smartAlerts = [];

let irrigationRecommendation = null;

let lastSmartAlertSignature = "";


// ============================================================
// HELPERS
// ============================================================

function getElement(id) {

    return document.getElementById(id);

}


function setText(id, value) {

    const element =
        getElement(id);

    if (element) {

        element.textContent =
            value;

    }

}


function clamp(
    value,
    min,
    max
) {

    return Math.max(
        min,
        Math.min(
            max,
            value
        )
    );

}


function isValidNumber(value) {

    return (
        value !== null &&
        value !== undefined &&
        value !== "" &&
        Number.isFinite(
            Number(value)
        )
    );

}


function numberOrNull(value) {

    if (!isValidNumber(value)) {

        return null;

    }

    return Number(value);

}


function formatNumber(
    value,
    decimals = 1
) {

    if (!isValidNumber(value)) {

        return "--";

    }

    return Number(value)
        .toFixed(decimals)
        .replace(/\.0+$/, "")
        .replace(/(\.\d*[1-9])0+$/, "$1");

}


function escapeHTML(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }


    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        String(value);


    return div.innerHTML;

}


function getSelectedCrop() {

    const cropSelect =
        getElement(
            "cropSelect"
        );


    if (
        cropSelect &&
        cropSelect.value
    ) {

        return cropSelect.value;

    }


    const settingsCrop =
        getElement(
            "settingsCrop"
        );


    if (
        settingsCrop &&
        settingsCrop.value
    ) {

        return settingsCrop.value;

    }


    return "Tomato";

}


function getTodayLocalDate() {

    const now =
        new Date();


    const year =
        now.getFullYear();


    const month =
        String(
            now.getMonth() + 1
        ).padStart(
            2,
            "0"
        );


    const day =
        String(
            now.getDate()
        ).padStart(
            2,
            "0"
        );


    return `${year}-${month}-${day}`;

}


// ============================================================
// TOAST
// ============================================================

function showToast(
    message,
    type = "info"
) {

    let toast =
        getElement(
            "agriaiToast"
        );


    if (!toast) {

        toast =
            document.createElement(
                "div"
            );

        toast.id =
            "agriaiToast";

        toast.style.position =
            "fixed";

        toast.style.right =
            "22px";

        toast.style.bottom =
            "22px";

        toast.style.zIndex =
            "99999";

        toast.style.maxWidth =
            "360px";

        toast.style.padding =
            "13px 17px";

        toast.style.borderRadius =
            "12px";

        toast.style.fontSize =
            "12px";

        toast.style.fontWeight =
            "700";

        toast.style.boxShadow =
            "0 10px 30px rgba(0,0,0,.15)";

        document.body.appendChild(
            toast
        );

    }


    if (type === "danger") {

        toast.style.background =
            "#fff0f0";

        toast.style.color =
            "#a32626";

        toast.style.border =
            "1px solid #f2c8c8";

    }

    else if (type === "warning") {

        toast.style.background =
            "#fff8e8";

        toast.style.color =
            "#8a5b00";

        toast.style.border =
            "1px solid #efd99d";

    }

    else if (type === "success") {

        toast.style.background =
            "#eef9f2";

        toast.style.color =
            "#217044";

        toast.style.border =
            "1px solid #cce8d5";

    }

    else {

        toast.style.background =
            "#eef5ff";

        toast.style.color =
            "#285b8f";

        toast.style.border =
            "1px solid #cbddef";

    }


    toast.textContent =
        message;


    toast.style.display =
        "block";


    clearTimeout(
        toast._timer
    );


    toast._timer =
        setTimeout(
            function () {

                toast.style.display =
                    "none";

            },
            4500
        );

}


// ============================================================
// PAGE NAVIGATION
// ============================================================

function initializeNavigation() {

    const navItems =
        document.querySelectorAll(
            "[data-page]"
        );


    const pages =
        document.querySelectorAll(
            ".page"
        );


    navItems.forEach(
        navItem => {

            navItem.addEventListener(
                "click",
                function () {

                    const targetPage =
                        this.getAttribute(
                            "data-page"
                        );


                    navItems.forEach(
                        item => {

                            item.classList.remove(
                                "active"
                            );

                        }
                    );


                    this.classList.add(
                        "active"
                    );


                    pages.forEach(
                        page => {

                            page.classList.remove(
                                "active"
                            );

                            page.classList.remove(
                                "active-page"
                            );

                        }
                    );


                    const target =
                        getElement(
                            targetPage
                        );


                    if (target) {

                        target.classList.add(
                            "active-page"
                        );

                        target.classList.add(
                            "active"
                        );

                    }


                    updatePageTitle(
                        targetPage
                    );


                    if (
                        targetPage ===
                        "history"
                    ) {

                        ensureHistoryCharts();

                        setTimeout(
                            function () {

                                resizeHistoryCharts();

                                updateHistoryCharts();

                            },
                            80
                        );

                    }


                    if (
                        targetPage ===
                        "dashboard"
                    ) {

                        setTimeout(
                            function () {

                                resizeDashboardCharts();

                                updateCharts();

                            },
                            80
                        );

                    }


                    if (
                        targetPage ===
                        "alerts"
                    ) {

                        updateSmartMonitoring();

                    }


                    const sidebar =
                        getElement(
                            "sidebar"
                        );


                    if (sidebar) {

                        sidebar.classList.remove(
                            "open"
                        );

                    }

                }
            );

        }
    );

}


// ============================================================
// PAGE TITLES
// ============================================================

function updatePageTitle(page) {

    const titles = {

        "dashboard": {

            title: "Dashboard",

            subtitle:
                "Monitor your farm in real time"

        },

        "crop-health": {

            title: "Crop Health",

            subtitle:
                "Detailed analysis of your crop condition"

        },

        "soil": {

            title: "Soil Monitoring",

            subtitle:
                "Monitor soil moisture and nutrient levels"

        },

        "ai": {

            title: "AI Analysis",

            subtitle:
                "AI-powered crop recommendations"

        },

        "image": {

            title: "Crop Image",

            subtitle:
                "Analyze your crop using AI vision"

        },

        "history": {

            title: "History",

            subtitle:
                "View previous sensor readings"

        },

        "alerts": {

            title: "Alerts",

            subtitle:
                "Important notifications from your farm"

        },

        "settings": {

            title: "Settings",

            subtitle:
                "Configure your AgriAI dashboard"

        }

    };


    const pageInfo =
        titles[page];


    if (!pageInfo) {

        return;

    }


    setText(
        "pageTitle",
        pageInfo.title
    );


    setText(
        "pageSubtitle",
        pageInfo.subtitle
    );

}


// ============================================================
// MOBILE MENU
// ============================================================

function initializeMenu() {

    const menuButton =
        getElement(
            "menuButton"
        );


    const sidebar =
        getElement(
            "sidebar"
        );


    if (
        !menuButton ||
        !sidebar
    ) {

        return;

    }


    menuButton.addEventListener(
        "click",
        function () {

            sidebar.classList.toggle(
                "open"
            );

        }
    );

}


// ============================================================
// CLOCK
// ============================================================

function updateClock() {

    const now =
        new Date();


    const time =
        now.toLocaleTimeString(
            [],
            {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit"
            }
        );


    setText(
        "currentTime",
        time
    );

}


function initializeClock() {

    updateClock();


    setInterval(
        updateClock,
        1000
    );

}


// ============================================================
// MOISTURE STATUS
// ============================================================

function getMoistureStatus(
    value
) {

    if (!isValidNumber(value)) {

        return "Unknown";

    }


    value =
        Number(value);


    if (
        value >= 40 &&
        value <= 80
    ) {

        return "Optimal";

    }


    if (
        value >= 30 &&
        value < 40
    ) {

        return "Moderate";

    }


    if (
        value > 80 &&
        value <= 90
    ) {

        return "High";

    }


    if (
        value > 90
    ) {

        return "Very High";

    }


    return "Low";

}


// ============================================================
// TEMPERATURE STATUS
// ============================================================

function getTemperatureStatus(
    value
) {

    if (!isValidNumber(value)) {

        return "Unknown";

    }


    value =
        Number(value);


    if (
        value < 15
    ) {

        return "Cold";

    }


    if (
        value >= 15 &&
        value <= 32
    ) {

        return "Optimal";

    }


    if (
        value > 32 &&
        value <= 38
    ) {

        return "Warm";

    }


    return "High";

}


// ============================================================
// HUMIDITY STATUS
// ============================================================

function getHumidityStatus(
    value
) {

    if (!isValidNumber(value)) {

        return "Unknown";

    }


    value =
        Number(value);


    if (
        value < 35
    ) {

        return "Low";

    }


    if (
        value <= 80
    ) {

        return "Optimal";

    }


    if (
        value <= 90
    ) {

        return "High";

    }


    return "Very High";

}


// ============================================================
// NUTRIENT STATUS
// ============================================================

function getNutrientStatus(
    value
) {

    if (!isValidNumber(value)) {

        return "Unknown";

    }


    value =
        Number(value);


    if (
        value < 30
    ) {

        return "Low";

    }


    if (
        value <= 80
    ) {

        return "Optimal";

    }


    return "High";

}


// ============================================================
// HEALTH SCORE
// ============================================================

function getDashboardHealthScore() {

    if (!sensorReady) {

        return null;

    }


    const moisture =
        Number(sensorData.moisture);


    const temperature =
        Number(sensorData.temperature);


    const humidity =
        Number(sensorData.humidity);


    const nitrogen =
        Number(sensorData.nitrogen);


    const phosphorus =
        Number(sensorData.phosphorus);


    const potassium =
        Number(sensorData.potassium);


    if (
        ![
            moisture,
            temperature,
            humidity,
            nitrogen,
            phosphorus,
            potassium
        ].every(
            Number.isFinite
        )
    ) {

        return null;

    }


    let moistureScore;


    if (
        moisture >= 40 &&
        moisture <= 80
    ) {

        moistureScore = 100;

    }

    else if (
        moisture >= 30 &&
        moisture < 40
    ) {

        moistureScore = 80;

    }

    else if (
        moisture > 80 &&
        moisture <= 90
    ) {

        moistureScore = 85;

    }

    else {

        moistureScore = 50;

    }


    let temperatureScore;


    if (
        temperature >= 18 &&
        temperature <= 32
    ) {

        temperatureScore = 100;

    }

    else if (
        temperature >= 15 &&
        temperature <= 38
    ) {

        temperatureScore = 75;

    }

    else {

        temperatureScore = 45;

    }


    let humidityScore;


    if (
        humidity >= 40 &&
        humidity <= 80
    ) {

        humidityScore = 100;

    }

    else if (
        humidity >= 30 &&
        humidity <= 90
    ) {

        humidityScore = 80;

    }

    else {

        humidityScore = 50;

    }


    function nutrientScore(value) {

        if (
            value >= 40 &&
            value <= 80
        ) {

            return 100;

        }

        if (
            value >= 30 &&
            value < 40
        ) {

            return 75;

        }

        if (
            value > 80 &&
            value <= 90
        ) {

            return 85;

        }

        return 55;

    }


    const score =

        moistureScore * 0.25 +

        temperatureScore * 0.20 +

        humidityScore * 0.15 +

        nutrientScore(nitrogen) * 0.1333 +

        nutrientScore(phosphorus) * 0.1333 +

        nutrientScore(potassium) * 0.1334;


    return Math.round(
        clamp(
            score,
            0,
            100
        )
    );

}


// ============================================================
// HEALTH STATUS
// ============================================================

function getHealthStatus(
    score
) {

    if (!isValidNumber(score)) {

        return "Waiting for sensor data";

    }


    score =
        Number(score);


    if (score >= 85) {

        return "Excellent";

    }


    if (score >= 70) {

        return "Healthy";

    }


    if (score >= 50) {

        return "Needs Attention";

    }


    return "Critical";

}


// ============================================================
// SENSOR DISPLAY
// ============================================================

function updateSensorDisplay() {

    setText(
        "moistureValue",
        isValidNumber(
            sensorData.moisture
        )
            ? formatNumber(
                sensorData.moisture
            ) + "%"
            : "--"
    );


    setText(
        "temperatureValue",
        isValidNumber(
            sensorData.temperature
        )
            ? formatNumber(
                sensorData.temperature
            ) + "°C"
            : "--"
    );


    setText(
        "humidityValue",
        isValidNumber(
            sensorData.humidity
        )
            ? formatNumber(
                sensorData.humidity
            ) + "%"
            : "--"
    );


    setText(
        "nitrogenValue",
        formatNumber(
            sensorData.nitrogen
        )
    );


    setText(
        "phosphorusValue",
        formatNumber(
            sensorData.phosphorus
        )
    );


    setText(
        "potassiumValue",
        formatNumber(
            sensorData.potassium
        )
    );


    setText(
        "soilN",
        formatNumber(
            sensorData.nitrogen
        )
    );


    setText(
        "soilP",
        formatNumber(
            sensorData.phosphorus
        )
    );


    setText(
        "soilK",
        formatNumber(
            sensorData.potassium
        )
    );


    setText(
        "soilMoisture",
        isValidNumber(
            sensorData.moisture
        )
            ? formatNumber(
                sensorData.moisture
            ) + "%"
            : "--%"
    );


    setText(
        "cropHealthSoilMoisture",
        isValidNumber(
            sensorData.moisture
        )
            ? formatNumber(
                sensorData.moisture
            ) + "%"
            : "--%"
    );


    const healthProgress =
        getElement(
            "healthMoisture"
        );


    if (healthProgress) {

        const moisture =
            isValidNumber(
                sensorData.moisture
            )
                ? clamp(
                    Number(
                        sensorData.moisture
                    ),
                    0,
                    100
                )
                : 0;


        healthProgress.style.width =
            moisture + "%";


        healthProgress.textContent =
            "";

    }


    const moistureStatus =
        getMoistureStatus(
            sensorData.moisture
        );


    setText(
        "moistureStatus",
        moistureStatus
    );


    const healthScore =
        getDashboardHealthScore();


    if (healthScore === null) {

        setText(
            "healthScore",
            "--"
        );


        setText(
            "healthCircleValue",
            "--"
        );


        setText(
            "cropHealthBig",
            "--"
        );


        setText(
            "healthStatus",
            "Waiting for sensor data"
        );

    }

    else {

        let status =
            getHealthStatus(
                healthScore
            );


        if (
            combinedAIResult &&
            combinedAIResult.overall_status
        ) {

            status =
                combinedAIResult.overall_status;

        }

        else if (
            healthAnalysis &&
            (
                healthAnalysis.status ||
                healthAnalysis.overall_status
            )
        ) {

            status =
                healthAnalysis.status ||
                healthAnalysis.overall_status;

        }


        setText(
            "healthScore",
            healthScore + "%"
        );


        setText(
            "healthCircleValue",
            healthScore + "%"
        );


        setText(
            "cropHealthBig",
            healthScore + "%"
        );


        setText(
            "healthStatus",
            status
        );

    }


    updateSmartMonitoring();

}


// ============================================================
// NORMALIZE SENSOR READING
// ============================================================

function normalizeSensorReading(
    reading
) {

    if (!reading) {

        return null;

    }


    return {

        moisture:
            numberOrNull(
                reading.moisture ??
                reading.soil_moisture
            ),

        temperature:
            numberOrNull(
                reading.temperature ??
                reading.temp
            ),

        humidity:
            numberOrNull(
                reading.humidity
            ),

        nitrogen:
            numberOrNull(
                reading.nitrogen ??
                reading.n
            ),

        phosphorus:
            numberOrNull(
                reading.phosphorus ??
                reading.p
            ),

        potassium:
            numberOrNull(
                reading.potassium ??
                reading.k
            ),

        timestamp:
            reading.timestamp ??
            reading.datetime ??
            reading.created_at ??
            "",

        source:
            reading.source ??
            ""

    };

}


// ============================================================
// FETCH LATEST SENSOR DATA
// ============================================================

async function fetchSensorData() {

    try {

        const response =
            await fetch(
                API_BASE +
                "/api/sensors/latest",
                {
                    cache: "no-store"
                }
            );


        if (!response.ok) {

            throw new Error(
                "Sensor API returned an error."
            );

        }


        const data =
            await response.json();


        console.log(
            "Latest sensor data:",
            data
        );


        let reading = null;


        if (
            data &&
            data.success &&
            data.data
        ) {

            reading =
                data.data;

        }

        else if (
            data &&
            data.data &&
            typeof data.data === "object"
        ) {

            reading =
                data.data;

        }

        else if (
            data &&
            data.reading
        ) {

            reading =
                data.reading;

        }

        else if (
            data &&
            (
                data.moisture !== undefined ||
                data.soil_moisture !== undefined
            )
        ) {

            reading =
                data;

        }


        const normalized =
            normalizeSensorReading(
                reading
            );


        if (normalized) {

            sensorData = {

                moisture:
                    normalized.moisture,

                temperature:
                    normalized.temperature,

                humidity:
                    normalized.humidity,

                nitrogen:
                    normalized.nitrogen,

                phosphorus:
                    normalized.phosphorus,

                potassium:
                    normalized.potassium

            };


            sensorReady = true;

        }


        updateSensorDisplay();


    }

    catch (error) {

        console.error(
            "Sensor fetch error:",
            error
        );

    }

}


// ============================================================
// FETCH CROP HEALTH
// ============================================================

async function fetchCropHealth() {

    try {

        const response =
            await fetch(
                API_BASE +
                "/api/crop-health",
                {
                    cache: "no-store"
                }
            );


        if (!response.ok) {

            throw new Error(
                "Crop health API failed."
            );

        }


        const data =
            await response.json();


        console.log(
            "Crop health:",
            data
        );


        if (
            data &&
            data.success
        ) {

            healthAnalysis =
                data;


            const reading =
                data.sensor_data ||
                (
                    data.data &&
                    data.data.sensor_data
                );


            const normalized =
                normalizeSensorReading(
                    reading
                );


            if (normalized) {

                sensorData = {

                    moisture:
                        normalized.moisture,

                    temperature:
                        normalized.temperature,

                    humidity:
                        normalized.humidity,

                    nitrogen:
                        normalized.nitrogen,

                    phosphorus:
                        normalized.phosphorus,

                    potassium:
                        normalized.potassium

                };


                sensorReady = true;

            }


            const health =
                data.health ||
                {};


            const description =
                health.description ||
                data.description ||
                health.summary ||
                data.summary;


            if (description) {

                setText(
                    "cropHealthDescription",
                    description
                );

            }

        }


        updateSensorDisplay();


    }

    catch (error) {

        console.error(
            "Crop health error:",
            error
        );

    }

}


// ============================================================
// FETCH HISTORY
// ============================================================

async function fetchHistory(
    limit = HISTORY_PAGE_SIZE,
    selectedDate = historySelectedDate,
    startTime = historyStartTime,
    endTime = historyEndTime,
    requestedOffset = historyOffset
) {

    if (historyLoading) {

        return;

    }


    historyLoading = true;


    requestedOffset =
        Math.max(
            0,
            Number(requestedOffset) || 0
        );


    limit =
        Math.max(
            1,
            Number(limit) || HISTORY_PAGE_SIZE
        );


    historySelectedDate =
        selectedDate || "";


    historyStartTime =
        startTime || "";


    historyEndTime =
        endTime || "";


    setText(
        "historyStatus",
        "Loading..."
    );


    updateHistoryPagination();


    try {

        let url =
            API_BASE +
            "/api/sensors/history?limit=" +
            encodeURIComponent(
                limit
            ) +
            "&offset=" +
            encodeURIComponent(
                requestedOffset
            );


        if (selectedDate) {

            url +=
                "&date=" +
                encodeURIComponent(
                    selectedDate
                );

        }


        if (startTime) {

            url +=
                "&start_time=" +
                encodeURIComponent(
                    startTime
                );

        }


        if (endTime) {

            url +=
                "&end_time=" +
                encodeURIComponent(
                    endTime
                );

        }


        console.log(
            "History request:",
            url
        );


        const response =
            await fetch(
                url,
                {
                    cache: "no-store"
                }
            );


        if (!response.ok) {

            throw new Error(
                "History API returned an error."
            );

        }


        const payload =
            await response.json();


        console.log(
            "History response:",
            payload
        );


        const parsed =
            extractHistoryResponse(
                payload,
                requestedOffset
            );


        historyData =
            parsed.rows;


        historyOffset =
            parsed.offset;


        historyTotalCount =
            parsed.totalCount;


        historyFilteredCount =
            parsed.filteredCount;


        historyHasMore =
            parsed.hasMore;


        historyNextOffset =
            parsed.nextOffset;


        historyPage =
            Math.floor(
                historyOffset /
                HISTORY_PAGE_SIZE
            ) + 1;


        if (
            historyData.length === 0 &&
            historyOffset > 0
        ) {

            historyLoading =
                false;


            await fetchHistory(
                HISTORY_PAGE_SIZE,
                historySelectedDate,
                historyStartTime,
                historyEndTime,
                Math.max(
                    0,
                    historyOffset -
                    HISTORY_PAGE_SIZE
                )
            );


            return;

        }


        updateHistoryTable();

        updateHistoryPagination();

        updateHistoryCharts();

        updateCharts();

        updateSmartMonitoring();


        setText(
            "historyStatus",
            historyData.length
                ? "Loaded"
                : "No readings"
        );


    }

    catch (error) {

        console.error(
            "History fetch error:",
            error
        );


        historyData =
            [];


        historyHasMore =
            false;


        updateHistoryTable();

        updateHistoryPagination();

        updateHistoryCharts();


        setText(
            "historyStatus",
            "History error"
        );

    }

    finally {

        historyLoading =
            false;


        updateHistoryPagination();

    }

}


// ============================================================
// EXTRACT HISTORY RESPONSE
// ============================================================

function extractHistoryResponse(
    payload,
    requestedOffset
) {

    let rows = [];


    let totalCount = null;

    let filteredCount = null;

    let hasMore = null;

    let nextOffset = null;

    let responseOffset =
        requestedOffset;


    if (Array.isArray(payload)) {

        rows =
            payload;

    }

    else if (
        payload &&
        Array.isArray(
            payload.data
        )
    ) {

        rows =
            payload.data;

    }

    else if (
        payload &&
        Array.isArray(
            payload.history
        )
    ) {

        rows =
            payload.history;

    }

    else if (
        payload &&
        Array.isArray(
            payload.readings
        )
    ) {

        rows =
            payload.readings;

    }


    const pagination =
        payload &&
        payload.pagination
            ? payload.pagination
            : {};


    function firstNumber(
        values
    ) {

        for (
            const value of values
        ) {

            if (
                isValidNumber(value)
            ) {

                return Number(value);

            }

        }


        return null;

    }


    totalCount =
        firstNumber([

            payload?.total_count,

            payload?.total,

            payload?.total_readings,

            payload?.count_total,

            pagination?.total_count,

            pagination?.total,

            payload?.meta?.total

        ]);


    filteredCount =
        firstNumber([

            payload?.filtered_count,

            payload?.filtered_total,

            payload?.total_filtered,

            pagination?.filtered_count,

            pagination?.filtered_total,

            payload?.meta?.filtered_count

        ]);


    responseOffset =
        firstNumber([

            payload?.offset,

            pagination?.offset,

            payload?.meta?.offset

        ]);


    if (
        responseOffset === null
    ) {

        responseOffset =
            requestedOffset;

    }


    nextOffset =
        firstNumber([

            payload?.next_offset,

            payload?.nextOffset,

            pagination?.next_offset,

            pagination?.nextOffset

        ]);


    if (
        payload?.has_more !== undefined
    ) {

        hasMore =
            Boolean(
                payload.has_more
            );

    }

    else if (
        payload?.hasMore !== undefined
    ) {

        hasMore =
            Boolean(
                payload.hasMore
            );

    }

    else if (
        pagination?.has_more !== undefined
    ) {

        hasMore =
            Boolean(
                pagination.has_more
            );

    }

    else if (
        pagination?.hasMore !== undefined
    ) {

        hasMore =
            Boolean(
                pagination.hasMore
            );

    }


    rows =
        rows.map(
            normalizeSensorReading
        ).filter(
            Boolean
        );


    if (
        filteredCount === null
    ) {

        if (
            !historySelectedDate &&
            !historyStartTime &&
            !historyEndTime &&
            totalCount !== null
        ) {

            filteredCount =
                totalCount;

        }

        else if (
            rows.length <
            HISTORY_PAGE_SIZE
        ) {

            filteredCount =
                responseOffset +
                rows.length;

        }

        else {

            filteredCount =
                Math.max(
                    responseOffset +
                    rows.length,
                    0
                );

        }

    }


    if (
        totalCount === null
    ) {

        totalCount =
            filteredCount !== null
                ? filteredCount
                : (
                    responseOffset +
                    rows.length
                );

    }


    if (
        hasMore === null
    ) {

        hasMore =
            (
                filteredCount !== null &&
                responseOffset +
                rows.length <
                filteredCount
            );

    }


    if (
        nextOffset === null
    ) {

        nextOffset =
            responseOffset +
            rows.length;

    }


    return {

        rows,

        offset:
            responseOffset,

        totalCount:
            Math.max(
                0,
                Number(
                    totalCount
                ) || 0
            ),

        filteredCount:
            Math.max(
                0,
                Number(
                    filteredCount
                ) || 0
            ),

        hasMore:
            Boolean(
                hasMore
            ),

        nextOffset:
            Math.max(
                0,
                Number(
                    nextOffset
                ) || 0
            )

    };

}


// ============================================================
// DATABASE STATS FALLBACK
// ============================================================

async function fetchDatabaseStatsFallback() {

    try {

        if (
            historyTotalCount > 0
        ) {

            return;

        }


        const response =
            await fetch(
                API_BASE +
                "/api/database/stats",
                {
                    cache: "no-store"
                }
            );


        if (!response.ok) {

            return;

        }


        const data =
            await response.json();


        const candidates = [

            data?.total_count,

            data?.total,

            data?.count,

            data?.total_readings,

            data?.data?.total_count,

            data?.data?.total,

            data?.stats?.total_count,

            data?.stats?.total

        ];


        const total =
            candidates.find(
                isValidNumber
            );


        if (
            isValidNumber(total)
        ) {

            historyTotalCount =
                Number(total);


            if (
                !historySelectedDate &&
                !historyStartTime &&
                !historyEndTime
            ) {

                historyFilteredCount =
                    historyTotalCount;

            }


            updateHistoryPagination();

        }

    }

    catch (error) {

        console.warn(
            "Database stats fallback failed:",
            error
        );

    }

}


// ============================================================
// HISTORY TABLE
// ============================================================

function updateHistoryTable() {

    const tableBody =
        getElement(
            "historyTableBody"
        );


    if (!tableBody) {

        return;

    }


    tableBody.innerHTML =
        "";


    const displayCount =
        historyFilteredCount ||
        historyTotalCount ||
        historyData.length;


    setText(
        "historyCount",
        displayCount
    );


    setText(
        "historyCountTop",
        displayCount
    );


    setText(
        "aiHistoryValue",
        displayCount
    );


    if (
        historyData.length === 0
    ) {

        const row =
            document.createElement(
                "tr"
            );


        row.innerHTML = `

            <td colspan="9">
                No sensor history available.
            </td>

        `;


        tableBody.appendChild(
            row
        );


        return;

    }


    const sources =
        [
            ...new Set(
                historyData
                    .map(
                        reading =>
                            reading.source
                    )
                    .filter(Boolean)
            )
        ];


    setText(
        "historySource",
        sources.length === 1
            ? sources[0]
            : "All"
    );


    historyData.forEach(
        reading => {

            const row =
                document.createElement(
                    "tr"
                );


            let dateText =
                "-";


            let timeText =
                "-";


            if (
                reading.timestamp
            ) {

                const date =
                    new Date(
                        reading.timestamp
                    );


                if (
                    !Number.isNaN(
                        date.getTime()
                    )
                ) {

                    dateText =
                        date.toLocaleDateString();


                    timeText =
                        date.toLocaleTimeString(
                            [],
                            {
                                hour:
                                    "2-digit",
                                minute:
                                    "2-digit",
                                second:
                                    "2-digit"
                            }
                        );

                }

            }


            row.innerHTML = `

                <td>
                    ${escapeHTML(
                        dateText
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        timeText
                    )}
                </td>

                <td>
                    ${formatNumber(
                        reading.moisture
                    )}
                </td>

                <td>
                    ${formatNumber(
                        reading.temperature
                    )}
                </td>

                <td>
                    ${formatNumber(
                        reading.humidity
                    )}
                </td>

                <td>
                    ${formatNumber(
                        reading.nitrogen
                    )}
                </td>

                <td>
                    ${formatNumber(
                        reading.phosphorus
                    )}
                </td>

                <td>
                    ${formatNumber(
                        reading.potassium
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        reading.source ||
                        "-"
                    )}
                </td>

            `;


            tableBody.appendChild(
                row
            );

        }
    );


    setText(
        "historyStatus",
        "Loaded"
    );

}


// ============================================================
// HISTORY PAGINATION UI
// ============================================================

function ensureHistoryPaginationUI() {

    let pagination =
        getElement(
            "historyPagination"
        );


    if (pagination) {

        return;

    }


    const historyPage =
        getElement(
            "history"
        );


    if (!historyPage) {

        return;

    }


    pagination =
        document.createElement(
            "div"
        );


    pagination.id =
        "historyPagination";


    pagination.style.display =
        "flex";


    pagination.style.alignItems =
        "center";


    pagination.style.justifyContent =
        "center";


    pagination.style.gap =
        "10px";


    pagination.style.marginTop =
        "16px";


    pagination.innerHTML = `

        <button
            type="button"
            id="historyPrevButton">
            Previous 100
        </button>

        <span
            id="historyPageIndicator">
            Page 1 of 1
        </span>

        <span
            id="historyPageBadge">
            1
        </span>

        <button
            type="button"
            id="historyNextButton">
            Next 100
        </button>

        <span
            id="historyRangeIndicator">
            Showing 0–0 of 0
        </span>

    `;


    historyPage.appendChild(
        pagination
    );

}


// ============================================================
// HISTORY PAGINATION EVENTS
// ============================================================

function initializeHistoryPagination() {

    ensureHistoryPaginationUI();


    const previousButton =
        getElement(
            "historyPrevButton"
        );


    const nextButton =
        getElement(
            "historyNextButton"
        );


    if (previousButton) {

        previousButton.addEventListener(
            "click",
            async function () {

                if (
                    historyLoading ||
                    historyOffset <= 0
                ) {

                    return;

                }


                const newOffset =
                    Math.max(
                        0,
                        historyOffset -
                        HISTORY_PAGE_SIZE
                    );


                await fetchHistory(
                    HISTORY_PAGE_SIZE,
                    historySelectedDate,
                    historyStartTime,
                    historyEndTime,
                    newOffset
                );

            }
        );

    }


    if (nextButton) {

        nextButton.addEventListener(
            "click",
            async function () {

                if (
                    historyLoading ||
                    !historyHasMore
                ) {

                    return;

                }


                await fetchHistory(
                    HISTORY_PAGE_SIZE,
                    historySelectedDate,
                    historyStartTime,
                    historyEndTime,
                    historyNextOffset
                );

            }
        );

    }

}


// ============================================================
// UPDATE PAGINATION
// ============================================================

function updateHistoryPagination() {

    ensureHistoryPaginationUI();


    const previousButton =
        getElement(
            "historyPrevButton"
        );


    const nextButton =
        getElement(
            "historyNextButton"
        );


    const pageIndicator =
        getElement(
            "historyPageIndicator"
        );


    const rangeIndicator =
        getElement(
            "historyRangeIndicator"
        );


    const pageBadge =
        getElement(
            "historyPageBadge"
        );


    const total =
        Number(
            historyFilteredCount ||
            historyTotalCount ||
            0
        );


    const totalPages =
        total > 0
            ? Math.ceil(
                total /
                HISTORY_PAGE_SIZE
            )
            : 1;


    const currentPage =
        Math.floor(
            Math.max(
                0,
                historyOffset
            ) /
            HISTORY_PAGE_SIZE
        ) + 1;


    historyPage =
        currentPage;


    const showingStart =
        total > 0 &&
        historyData.length > 0
            ? historyOffset + 1
            : 0;


    const showingEnd =
        total > 0
            ? Math.min(
                historyOffset +
                historyData.length,
                total
            )
            : 0;


    if (pageIndicator) {

        pageIndicator.textContent =
            `Page ${currentPage} of ${totalPages}`;

    }


    if (pageBadge) {

        pageBadge.textContent =
            String(
                currentPage
            );

    }


    if (rangeIndicator) {

        rangeIndicator.textContent =
            `Showing ${showingStart}–${showingEnd} of ${total.toLocaleString()}`;

    }


    if (previousButton) {

        previousButton.disabled =
            historyLoading ||
            historyOffset <= 0;

    }


    if (nextButton) {

        nextButton.disabled =
            historyLoading ||
            !historyHasMore ||
            currentPage >= totalPages;

    }

}


// ============================================================
// CHART INITIALIZATION
// ============================================================

function initializeCharts() {

    if (
        typeof Chart ===
        "undefined"
    ) {

        console.warn(
            "Chart.js is not available."
        );

        return;

    }


    initializeDashboardCharts();

    ensureHistoryCharts();

}


// ============================================================
// DASHBOARD CHARTS
// ============================================================

function initializeDashboardCharts() {

    const environmentCanvas =
        getElement(
            "environmentChart"
        );


    if (
        environmentCanvas &&
        !environmentChart
    ) {

        environmentChart =
            new Chart(
                environmentCanvas,
                {

                    type: "line",

                    data: {

                        labels: [],

                        datasets: [

                            {
                                label:
                                    "Soil Moisture",

                                data: [],

                                tension:
                                    0.3
                            },

                            {
                                label:
                                    "Temperature",

                                data: [],

                                tension:
                                    0.3
                            },

                            {
                                label:
                                    "Humidity",

                                data: [],

                                tension:
                                    0.3
                            }

                        ]

                    },

                    options: {

                        responsive: true,

                        maintainAspectRatio:
                            false,

                        interaction: {

                            mode:
                                "index",

                            intersect:
                                false

                        },

                        plugins: {

                            legend: {

                                display:
                                    true

                            }

                        },

                        scales: {

                            y: {

                                beginAtZero:
                                    true

                            }

                        }

                    }

                }
            );

    }


    const npkCanvas =
        getElement(
            "npkChart"
        );


    if (
        npkCanvas &&
        !npkChart
    ) {

        npkChart =
            new Chart(
                npkCanvas,
                {

                    type: "bar",

                    data: {

                        labels: [

                            "Nitrogen",

                            "Phosphorus",

                            "Potassium"

                        ],

                        datasets: [

                            {
                                label:
                                    "NPK Levels",

                                data: [
                                    0,
                                    0,
                                    0
                                ]

                            }

                        ]

                    },

                    options: {

                        responsive: true,

                        maintainAspectRatio:
                            false,

                        scales: {

                            y: {

                                beginAtZero:
                                    true

                            }

                        }

                    }

                }
            );

    }

}


// ============================================================
// HISTORY CHARTS
// ============================================================

function ensureHistoryCharts() {

    if (
        typeof Chart ===
        "undefined"
    ) {

        return;

    }


    const environmentCanvas =
        getElement(
            "historyEnvironmentChart"
        );


    if (
        environmentCanvas &&
        !historyEnvironmentChart
    ) {

        historyEnvironmentChart =
            new Chart(
                environmentCanvas,
                {

                    type: "line",

                    data: {

                        labels: [],

                        datasets: [

                            {
                                label:
                                    "Soil Moisture",

                                data: [],

                                tension:
                                    0.3
                            },

                            {
                                label:
                                    "Temperature",

                                data: [],

                                tension:
                                    0.3
                            },

                            {
                                label:
                                    "Humidity",

                                data: [],

                                tension:
                                    0.3
                            }

                        ]

                    },

                    options: {

                        responsive: true,

                        maintainAspectRatio:
                            false,

                        interaction: {

                            mode:
                                "index",

                            intersect:
                                false

                        },

                        scales: {

                            y: {

                                beginAtZero:
                                    true

                            }

                        }

                    }

                }
            );

    }


    const npkCanvas =
        getElement(
            "historyNpkChart"
        );


    if (
        npkCanvas &&
        !historyNpkChart
    ) {

        historyNpkChart =
            new Chart(
                npkCanvas,
                {

                    type: "bar",

                    data: {

                        labels: [

                            "Nitrogen",

                            "Phosphorus",

                            "Potassium"

                        ],

                        datasets: [

                            {
                                label:
                                    "NPK Levels",

                                data: [
                                    0,
                                    0,
                                    0
                                ]

                            }

                        ]

                    },

                    options: {

                        responsive: true,

                        maintainAspectRatio:
                            false,

                        scales: {

                            y: {

                                beginAtZero:
                                    true

                            }

                        }

                    }

                }
            );

    }

}


// ============================================================
// UPDATE DASHBOARD CHARTS
// ============================================================

function updateCharts() {

    if (
        !historyData.length
    ) {

        return;

    }


    if (
        !environmentChart &&
        !npkChart
    ) {

        initializeDashboardCharts();

    }


    const data =
        [...historyData]
            .reverse();


    const labels =
        data.map(
            reading => {

                if (
                    !reading.timestamp
                ) {

                    return "";

                }


                const date =
                    new Date(
                        reading.timestamp
                    );


                if (
                    Number.isNaN(
                        date.getTime()
                    )
                ) {

                    return "";

                }


                return date.toLocaleTimeString(
                    [],
                    {
                        hour:
                            "2-digit",
                        minute:
                            "2-digit"
                    }
                );

            }
        );


    const moisture =
        data.map(
            reading =>
                isValidNumber(
                    reading.moisture
                )
                    ? Number(
                        reading.moisture
                    )
                    : null
        );


    const temperature =
        data.map(
            reading =>
                isValidNumber(
                    reading.temperature
                )
                    ? Number(
                        reading.temperature
                    )
                    : null
        );


    const humidity =
        data.map(
            reading =>
                isValidNumber(
                    reading.humidity
                )
                    ? Number(
                        reading.humidity
                    )
                    : null
        );


    if (environmentChart) {

        environmentChart.data.labels =
            labels;


        environmentChart.data.datasets[0].data =
            moisture;


        environmentChart.data.datasets[1].data =
            temperature;


        environmentChart.data.datasets[2].data =
            humidity;


        environmentChart.update(
            "none"
        );

    }


    if (
        npkChart &&
        data.length
    ) {

        const latest =
            data[
                data.length - 1
            ];


        npkChart.data.datasets[0].data = [

            numberOrNull(
                latest.nitrogen
            ) ?? 0,

            numberOrNull(
                latest.phosphorus
            ) ?? 0,

            numberOrNull(
                latest.potassium
            ) ?? 0

        ];


        npkChart.update(
            "none"
        );

    }

}


// ============================================================
// UPDATE HISTORY CHARTS
// ============================================================

function updateHistoryCharts() {

    ensureHistoryCharts();


    if (
        !historyData.length
    ) {

        if (historyEnvironmentChart) {

            historyEnvironmentChart.data.labels =
                [];

            historyEnvironmentChart.data.datasets.forEach(
                dataset => {

                    dataset.data =
                        [];

                }
            );

            historyEnvironmentChart.update(
                "none"
            );

        }


        if (historyNpkChart) {

            historyNpkChart.data.datasets[0].data =
                [
                    0,
                    0,
                    0
                ];

            historyNpkChart.update(
                "none"
            );

        }


        return;

    }


    const data =
        [...historyData]
            .reverse();


    const labels =
        data.map(
            reading => {

                if (
                    !reading.timestamp
                ) {

                    return "";

                }


                const date =
                    new Date(
                        reading.timestamp
                    );


                if (
                    Number.isNaN(
                        date.getTime()
                    )
                ) {

                    return "";

                }


                return date.toLocaleTimeString(
                    [],
                    {
                        hour:
                            "2-digit",
                        minute:
                            "2-digit",
                        second:
                            "2-digit"
                    }
                );

            }
        );


    const moisture =
        data.map(
            reading =>
                numberOrNull(
                    reading.moisture
                )
        );


    const temperature =
        data.map(
            reading =>
                numberOrNull(
                    reading.temperature
                )
        );


    const humidity =
        data.map(
            reading =>
                numberOrNull(
                    reading.humidity
                )
        );


    if (
        historyEnvironmentChart
    ) {

        historyEnvironmentChart.data.labels =
            labels;


        historyEnvironmentChart.data.datasets[0].data =
            moisture;


        historyEnvironmentChart.data.datasets[1].data =
            temperature;


        historyEnvironmentChart.data.datasets[2].data =
            humidity;


        historyEnvironmentChart.update(
            "none"
        );

    }


    if (
        historyNpkChart &&
        data.length
    ) {

        const latest =
            data[
                data.length - 1
            ];


        historyNpkChart.data.datasets[0].data = [

            numberOrNull(
                latest.nitrogen
            ) ?? 0,

            numberOrNull(
                latest.phosphorus
            ) ?? 0,

            numberOrNull(
                latest.potassium
            ) ?? 0

        ];


        historyNpkChart.update(
            "none"
        );

    }

}


// ============================================================
// RESIZE CHARTS
// ============================================================

function resizeDashboardCharts() {

    if (environmentChart) {

        environmentChart.resize();

    }


    if (npkChart) {

        npkChart.resize();

    }

}


function resizeHistoryCharts() {

    if (historyEnvironmentChart) {

        historyEnvironmentChart.resize();

    }


    if (historyNpkChart) {

        historyNpkChart.resize();

    }

}


// ============================================================
// SYSTEM STATUS
// ============================================================

async function fetchSystemStatus() {

    try {

        const response =
            await fetch(
                API_BASE +
                "/api/status",
                {
                    cache: "no-store"
                }
            );


        if (!response.ok) {

            throw new Error(
                "Status API failed."
            );

        }


        const data =
            await response.json();


        console.log(
            "System status:",
            data
        );


        updateSystemStatus(
            data
        );

    }

    catch (error) {

        console.error(
            "System status error:",
            error
        );


        updateDeviceStatus(
            false,
            null
        );


        updateDataMode(
            false
        );

    }

}


// ============================================================
// UPDATE SYSTEM STATUS
// ============================================================

function updateSystemStatus(
    data
) {

    if (!data) {

        return;

    }


    const connected =
        Boolean(

            data.esp32 &&
            data.esp32.connected

        );


    const ip =
        data.esp32 &&
        data.esp32.ip
            ? data.esp32.ip
            : null;


    esp32Connected =
        connected;


    esp32IP =
        ip;


    updateDeviceStatus(
        connected,
        ip
    );


    updateDataMode(
        connected
    );


    updateSmartMonitoring();

}


// ============================================================
// DATA MODE
// ============================================================

function updateDataMode(
    connected
) {

    const dataMode =
        document.querySelector(
            ".data-mode"
        );


    if (!dataMode) {

        return;

    }


    if (connected) {

        dataMode.innerHTML = `

            <span class="status-dot"></span>

            <span>ESP32 LIVE</span>

        `;

    }

    else {

        dataMode.innerHTML = `

            <span class="status-dot"></span>

            <span>DEMO DATA</span>

        `;

    }

}


// ============================================================
// DEVICE STATUS
// ============================================================

function updateDeviceStatus(
    connected = null,
    ip = null
) {

    const dot =
        getElement(
            "deviceStatusDot"
        );


    const status =
        getElement(
            "deviceStatus"
        );


    const info =
        getElement(
            "deviceInfo"
        );


    if (
        connected === null
    ) {

        return;

    }


    if (connected) {

        if (status) {

            status.textContent =
                "Connected";

        }


        if (info) {

            info.textContent =
                ip &&
                ip !== "Not connected"
                    ? "ESP32 • " + ip
                    : "ESP32";

        }


        if (dot) {

            dot.classList.add(
                "connected"
            );

        }

    }

    else {

        if (status) {

            status.textContent =
                "Disconnected";

        }


        if (info) {

            info.textContent =
                "ESP32";

        }


        if (dot) {

            dot.classList.remove(
                "connected"
            );

        }

    }

}


// ============================================================
// ESP32 STATUS CHECK
// ============================================================

async function checkESP32Status() {

    try {

        const response =
            await fetch(
                API_BASE +
                "/api/status",
                {
                    cache: "no-store"
                }
            );


        if (!response.ok) {

            throw new Error(
                "ESP32 status request failed."
            );

        }


        const data =
            await response.json();


        console.log(
            "ESP32 status:",
            data
        );


        updateSystemStatus(
            data
        );

    }

    catch (error) {

        console.error(
            "ESP32 status error:",
            error
        );


        esp32Connected =
            false;


        updateDeviceStatus(
            false,
            null
        );


        updateDataMode(
            false
        );

    }

}


// ============================================================
// CROP SETTINGS
// ============================================================

function initializeCropSettings() {

    const cropSelect =
        getElement(
            "cropSelect"
        );


    const settingsCrop =
        getElement(
            "settingsCrop"
        );


    if (cropSelect) {

        if (
            settingsCrop &&
            settingsCrop.value
        ) {

            cropSelect.value =
                settingsCrop.value;

        }


        cropSelect.addEventListener(
            "change",
            function () {

                console.log(
                    "Crop selected:",
                    this.value
                );


                combinedAIResult =
                    null;


                healthAnalysis =
                    null;


                if (settingsCrop) {

                    settingsCrop.value =
                        this.value;

                }


                updateSensorDisplay();

            }
        );

    }


    if (settingsCrop) {

        settingsCrop.addEventListener(
            "change",
            function () {

                console.log(
                    "Settings crop:",
                    this.value
                );


                if (cropSelect) {

                    cropSelect.value =
                        this.value;

                }


                combinedAIResult =
                    null;


                healthAnalysis =
                    null;


                updateSensorDisplay();

            }
        );

    }

}


// ============================================================
// DATA SOURCE
// ============================================================

function initializeDataSource() {

    const sourceSelect =
        getElement(
            "dataSource"
        );


    if (!sourceSelect) {

        return;

    }


    sourceSelect.addEventListener(
        "change",
        function () {

            console.log(
                "Data source:",
                this.value
            );

        }
    );

}


// ============================================================
// IMAGE UPLOAD
// ============================================================

function initializeImageUpload() {

    const imageInput =
        getElement(
            "imageInput"
        );


    const uploadButton =
        getElement(
            "uploadButton"
        );


    const preview =
        getElement(
            "imagePreview"
        );


    const placeholder =
        getElement(
            "imagePlaceholder"
        );


    if (
        !imageInput ||
        !uploadButton
    ) {

        return;

    }


    uploadButton.addEventListener(
        "click",
        function () {

            imageInput.click();

        }
    );


    imageInput.addEventListener(
        "change",
        async function () {

            const file =
                this.files &&
                this.files.length
                    ? this.files[0]
                    : null;


            if (!file) {

                selectedCropImageFile =
                    null;

                return;

            }


            if (
                !file.type.startsWith(
                    "image/"
                )
            ) {

                alert(
                    "Please select a valid image."
                );


                this.value =
                    "";


                selectedCropImageFile =
                    null;


                return;

            }


            selectedCropImageFile =
                file;


            console.log(
                "Selected image:",
                file.name
            );


            if (preview) {

                if (
                    preview.dataset.objectUrl
                ) {

                    URL.revokeObjectURL(
                        preview.dataset.objectUrl
                    );

                }


                const objectUrl =
                    URL.createObjectURL(
                        file
                    );


                preview.src =
                    objectUrl;


                preview.dataset.objectUrl =
                    objectUrl;


                preview.style.display =
                    "block";

            }


            if (placeholder) {

                placeholder.style.display =
                    "none";

            }


            const aiImagePreviewWrap =
                getElement(
                    "aiImagePreviewWrap"
                );


            const aiImagePreview =
                getElement(
                    "aiImagePreview"
                );


            if (
                aiImagePreview
            ) {

                aiImagePreview.src =
                    preview
                        ? preview.src
                        : URL.createObjectURL(
                            file
                        );

                aiImagePreview.style.display =
                    "block";

            }


            if (
                aiImagePreviewWrap
            ) {

                aiImagePreviewWrap.style.display =
                    "block";

            }


            const aiImageStatus =
                getElement(
                    "aiImageStatus"
                );


            if (
                aiImageStatus
            ) {

                aiImageStatus.textContent =
                    file.name;

            }


            

        }
    );

}


// ============================================================
// IMAGE AI ANALYSIS
// ============================================================

async function analyzeCropImage(
    file
) {

    const resultElement =
        getElement(
            "imageAIResult"
        );


    if (resultElement) {

        resultElement.innerHTML = `

            <p>
                🔍 Analyzing crop image...
            </p>

        `;

    }


    try {

        const formData =
            new FormData();


        formData.append(
            "image",
            file
        );


        const crop =
            getSelectedCrop();


        formData.append(
            "crop",
            crop
        );


        const response =
            await fetch(
                API_BASE +
                "/api/ai/image",
                {

                    method:
                        "POST",

                    body:
                        formData

                }
            );


        const data =
            await response.json();


        if (
            !response.ok ||
            !data.success
        ) {

            throw new Error(
                data.error ||
                "Image AI analysis failed."
            );

        }


        console.log(
            "Image AI result:",
            data
        );


        displayImageAIResult(
            data.analysis
        );

    }

    catch (error) {

        console.error(
            "Image AI error:",
            error
        );


        if (resultElement) {

            resultElement.innerHTML = `

                <div class="error-message">

                    <strong>
                        Image analysis failed:
                    </strong>

                    ${escapeHTML(
                        error.message
                    )}

                </div>

            `;

        }

    }

}


// ============================================================
// DISPLAY IMAGE AI RESULT
// ============================================================

function displayImageAIResult(
    analysis
) {

    const resultElement =
        getElement(
            "imageAIResult"
        );


    if (!resultElement) {

        return;

    }


    if (!analysis) {

        resultElement.innerHTML =
            "<p>No image analysis returned.</p>";

        return;

    }


    const observations =
        Array.isArray(
            analysis.visual_observations
        )
            ? analysis.visual_observations
            : [];


    const concerns =
        Array.isArray(
            analysis.possible_concerns
        )
            ? analysis.possible_concerns
            : [];


    const observationsHTML =
        observations.length

            ? observations
                .map(
                    item =>
                        `<li>${escapeHTML(item)}</li>`
                )
                .join("")

            : "<li>No major visual observations.</li>";


    const concernsHTML =
        concerns.length

            ? concerns
                .map(
                    item =>
                        `<li>${escapeHTML(item)}</li>`
                )
                .join("")

            : "<li>No major concerns detected.</li>";


    resultElement.innerHTML = `

        <div class="ai-result-card">

            <h3>
                🌿 Image AI Analysis
            </h3>

            <p>

                <strong>
                    Plant Condition:
                </strong>

                ${escapeHTML(
                    analysis.plant_condition ||
                    "-"
                )}

            </p>

            <p>

                <strong>
                    Stress Level:
                </strong>

                ${escapeHTML(
                    analysis.stress_level ||
                    "-"
                )}

            </p>

            <p>

                <strong>
                    Image Health:
                </strong>

                ${
                    analysis.image_health_score ??
                    "-"
                }/100

            </p>

            <p>

                <strong>
                    Visual Observations:
                </strong>

            </p>

            <ul>

                ${observationsHTML}

            </ul>

            <p>

                <strong>
                    Possible Concerns:
                </strong>

            </p>

            <ul>

                ${concernsHTML}

            </ul>

            <p>

                <strong>
                    Summary:
                </strong>

                ${escapeHTML(
                    analysis.summary ||
                    "-"
                )}

            </p>

        </div>

    `;

}


// ============================================================
// SENSOR AI
// ============================================================

function initializeAI() {

    const analyzeButton =
        getElement(
            "analyzeButton"
        );


    if (!analyzeButton) {

        return;

    }


    analyzeButton.addEventListener(
        "click",
        analyzeSensorAI
    );

}


// ============================================================
// SENSOR AI ANALYSIS
// ============================================================

async function analyzeSensorAI() {

    const resultElement =
        getElement(
            "aiResult"
        );

    const button =
        getElement(
            "analyzeButton"
        );


    if (resultElement) {

        resultElement.innerHTML = `

            <div class="ai-loading-card">

                <div class="ai-loading-spinner">
                    🧠
                </div>

                <h3>
                    Analyzing Crop...
                </h3>

                <p>
                    Gemini is analyzing the sensor readings
                    ${
                        selectedCropImageFile
                            ? "and your uploaded crop image"
                            : ""
                    }.
                </p>

            </div>

        `;

    }


    if (button) {

        button.disabled =
            true;

        button.textContent =
            selectedCropImageFile
                ? "🧠 Analyzing Crop + Image..."
                : "🧠 Analyzing...";

    }


    try {

        const crop =
            getSelectedCrop();


        // ====================================================
        // SEND MULTIPART FORM
        // ====================================================

        const formData =
            new FormData();


        formData.append(
            "crop",
            crop
        );


        formData.append(
            "sensor_data",
            JSON.stringify(
                sensorData
            )
        );


        // Send a small recent history window too.
        const recentHistory =
            Array.isArray(historyData)
                ? historyData.slice(
                    0,
                    20
                )
                : [];


        formData.append(
            "historical_readings",
            JSON.stringify(
                recentHistory
            )
        );


        // ====================================================
        // IMAGE
        // ====================================================

        if (
            selectedCropImageFile
        ) {

            formData.append(
                "image",
                selectedCropImageFile
            );

        }


        // ====================================================
        // REQUEST
        // ====================================================

        const response =
            await fetch(
                API_BASE +
                "/api/ai/analyze",
                {

                    method:
                        "POST",

                    body:
                        formData

                }
            );


        const data =
            await response.json();


        if (
            !response.ok ||
            !data.success
        ) {

            throw new Error(
                data.error ||
                "AI crop analysis failed."
            );

        }


        console.log(
            "Sensor + Image AI result:",
            data
        );


        healthAnalysis =
            data.analysis ||
            null;


        combinedAIResult =
            null;


        updateSensorDisplay();


        displaySensorAIResult(
            data.analysis
        );


    }

    catch (error) {

        console.error(
            "Sensor AI error:",
            error
        );


        if (resultElement) {

            resultElement.innerHTML = `

                <div class="error-message">

                    <strong>
                        AI analysis failed:
                    </strong>

                    <p>
                        ${escapeHTML(
                            error.message
                        )}
                    </p>

                </div>

            `;

        }

    }

    finally {

        if (button) {

            button.disabled =
                false;

            button.textContent =
                "🤖 Analyze Crop";

        }

    }

}

// ============================================================
// DISPLAY SENSOR AI RESULT
// ============================================================

function displaySensorAIResult(
    analysis
) {

    const resultElement =
        getElement(
            "aiResult"
        );


    if (!resultElement) {

        return;

    }


    if (!analysis) {

        resultElement.innerHTML =
            `
            <div class="error-message">
                No AI analysis was returned.
            </div>
            `;

        return;

    }


    const observations =
        Array.isArray(
            analysis.visual_observations
        )
            ? analysis.visual_observations
            : [];


    const concerns =
        Array.isArray(
            analysis.possible_concerns
        )
            ? analysis.possible_concerns
            : [];


    const actions =
        Array.isArray(
            analysis.actions
        )
            ? analysis.actions
            : [];


    const overallScore =
        isValidNumber(
            analysis.overall_health_score
        )
            ? Math.round(
                Number(
                    analysis.overall_health_score
                )
            )
            : "-";


    const sensorScore =
        isValidNumber(
            analysis.sensor_health_score
        )
            ? Math.round(
                Number(
                    analysis.sensor_health_score
                )
            )
            : "-";


    const imageScore =
        isValidNumber(
            analysis.image_health_score
        )
            ? Math.round(
                Number(
                    analysis.image_health_score
                )
            )
            : "-";


    const observationsHTML =
        observations.length

            ? observations
                .map(
                    item =>
                        `
                        <li>
                            ${escapeHTML(item)}
                        </li>
                        `
                )
                .join("")

            : `
                <li>
                    No specific visual observations were returned.
                </li>
            `;


    const concernsHTML =
        concerns.length

            ? concerns
                .map(
                    item =>
                        `
                        <li>
                            ${escapeHTML(item)}
                        </li>
                        `
                )
                .join("")

            : `
                <li>
                    No major concerns were identified from
                    the available information.
                </li>
            `;


    const actionsHTML =
        actions.length

            ? actions
                .map(
                    item =>
                        `
                        <li>
                            ${escapeHTML(item)}
                        </li>
                        `
                )
                .join("")

            : `
                <li>
                    Continue monitoring the crop and sensor readings.
                </li>
            `;


    const imageUsed =
        Boolean(
            selectedCropImageFile
        );


    resultElement.innerHTML = `

        <div class="ai-result-card ai-detailed-result">

            <!-- =========================================
                 HEADER
                 ========================================= -->

            <div class="ai-result-header">

                <div>

                    <span class="ai-result-kicker">
                        AI CROP ASSESSMENT
                    </span>

                    <h2>
                        🤖 Crop Health Analysis
                    </h2>

                    <p>
                        Current sensor data
                        ${
                            imageUsed
                                ? "+ uploaded crop image"
                                : ""
                        }
                    </p>

                </div>


                <div class="ai-health-score">

                    <strong>
                        ${overallScore}
                    </strong>

                    <span>
                        /100
                    </span>

                    <small>
                        Health
                    </small>

                </div>

            </div>


            <!-- =========================================
                 STATUS STRIP
                 ========================================= -->

            <div class="ai-status-strip">

                <div>

                    <span>
                        STATUS
                    </span>

                    <strong>
                        ${escapeHTML(
                            analysis.overall_status ||
                            "-"
                        )}
                    </strong>

                </div>


                <div>

                    <span>
                        STRESS
                    </span>

                    <strong>
                        ${escapeHTML(
                            analysis.stress_level ||
                            "-"
                        )}
                    </strong>

                </div>


                <div>

                    <span>
                        CONFIDENCE
                    </span>

                    <strong>
                        ${escapeHTML(
                            analysis.confidence ||
                            "-"
                        )}
                    </strong>

                </div>

            </div>


            <!-- =========================================
                 SCORE BREAKDOWN
                 ========================================= -->

            <div class="ai-score-grid">

                <div class="ai-score-card-mini">

                    <span>
                        📡 Sensor Health
                    </span>

                    <strong>
                        ${sensorScore}/100
                    </strong>

                </div>


                <div class="ai-score-card-mini">

                    <span>
                        📷 Image Health
                    </span>

                    <strong>
                        ${
                            imageUsed
                                ? `${imageScore}/100`
                                : "No image"
                        }
                    </strong>

                </div>

            </div>


            <!-- =========================================
                 PLANT CONDITION
                 ========================================= -->

            <div class="ai-section ai-highlight-section">

                <h3>
                    🌱 Plant Condition
                </h3>

                <p>
                    ${escapeHTML(
                        analysis.plant_condition ||
                        "Unable to determine."
                    )}
                </p>

            </div>


            <!-- =========================================
                 SUMMARY
                 ========================================= -->

            <div class="ai-section">

                <h3>
                    📝 AI Summary
                </h3>

                <p>
                    ${escapeHTML(
                        analysis.summary ||
                        "No summary was returned."
                    )}
                </p>

            </div>


            <!-- =========================================
                 ENVIRONMENT
                 ========================================= -->

            <div class="ai-section">

                <h3>
                    🌍 Soil & Environment
                </h3>


                <div class="ai-detail-grid">

                    <div>

                        <span>
                            💧 Soil Moisture
                        </span>

                        <strong>
                            ${escapeHTML(
                                analysis.soil_moisture_status ||
                                "-"
                            )}
                        </strong>

                    </div>


                    <div>

                        <span>
                            🌡️ Temperature
                        </span>

                        <strong>
                            ${escapeHTML(
                                analysis.temperature_status ||
                                "-"
                            )}
                        </strong>

                    </div>


                    <div>

                        <span>
                            💨 Humidity
                        </span>

                        <strong>
                            ${escapeHTML(
                                analysis.humidity_status ||
                                "-"
                            )}
                        </strong>

                    </div>


                    <div>

                        <span>
                            🧪 Nutrients
                        </span>

                        <strong>
                            ${escapeHTML(
                                analysis.nutrient_status ||
                                "-"
                            )}
                        </strong>

                    </div>

                </div>

            </div>


            <!-- =========================================
                 WATER
                 ========================================= -->

            <div class="ai-section">

                <h3>
                    💧 Water Requirement
                </h3>

                <div class="ai-recommendation-box">

                    <strong>
                        Need:
                    </strong>

                    <p>
                        ${escapeHTML(
                            analysis.water_need ||
                            "-"
                        )}
                    </p>


                    <strong>
                        Recommendation:
                    </strong>

                    <p>
                        ${escapeHTML(
                            analysis.water_recommendation ||
                            "-"
                        )}
                    </p>

                </div>

            </div>


            <!-- =========================================
                 NUTRIENTS
                 ========================================= -->

            <div class="ai-section">

                <h3>
                    🧪 Nutrient Recommendation
                </h3>

                <p>
                    ${escapeHTML(
                        analysis.nutrient_recommendation ||
                        "-"
                    )}
                </p>

            </div>


            <!-- =========================================
                 IMAGE OBSERVATIONS
                 ========================================= -->

            <div class="ai-section">

                <h3>
                    👁️ What AI Sees in the Crop Image
                </h3>

                ${
                    imageUsed

                        ? `

                            <ul class="ai-analysis-list">

                                ${observationsHTML}

                            </ul>

                        `

                        : `

                            <div class="ai-no-image">

                                📷 No crop image was supplied
                                for visual analysis.

                            </div>

                        `
                }

            </div>


            <!-- =========================================
                 CONCERNS
                 ========================================= -->

            <div class="ai-section">

                <h3>
                    ⚠️ Possible Concerns
                </h3>

                <ul class="ai-analysis-list">

                    ${concernsHTML}

                </ul>

            </div>


            <!-- =========================================
                 ACTIONS
                 ========================================= -->

            <div class="ai-section">

                <h3>
                    ✅ Recommended Actions
                </h3>

                <ul class="ai-analysis-list">

                    ${actionsHTML}

                </ul>

            </div>


            <!-- =========================================
                 FOOTER
                 ========================================= -->

            <div class="ai-analysis-footer">

                <span>
                    🌱 Crop:
                    ${escapeHTML(
                        getSelectedCrop()
                    )}
                </span>

                <span>
                    📡 Live sensor analysis
                </span>

                <span>
                    ${
                        imageUsed
                            ? "📷 Image analyzed"
                            : "📷 No image"
                    }
                </span>

            </div>

        </div>

    `;

}


// ============================================================
// FULL AI ANALYSIS BUTTON
// ============================================================

function initializeCombinedAI() {

    const button =
        getElement(
            "combinedAIButton"
        );


    if (!button) {

        console.error(
            "Full AI button not found: #combinedAIButton"
        );

        return;

    }


    // Prevent duplicate event listeners
    if (
        button.dataset.aiInitialized === "true"
    ) {

        return;

    }


    button.dataset.aiInitialized =
        "true";


    button.type =
        "button";


    button.addEventListener(
        "click",
        analyzeCombinedAI
    );


    console.log(
        "✅ Full AI Analysis button initialized."
    );

}


// ============================================================
// FULL AI ANALYSIS
// ============================================================

async function analyzeCombinedAI() {

    const button =
        getElement(
            "combinedAIButton"
        );


    const resultElement =
        getElement(
            "aiResult"
        );


    const crop =
        getSelectedCrop();


    // --------------------------------------------------------
    // Prevent double-click
    // --------------------------------------------------------

    if (
        button &&
        button.disabled
    ) {

        return;

    }


    // --------------------------------------------------------
    // Loading UI
    // --------------------------------------------------------

    if (button) {

        button.disabled =
            true;

        button.textContent =
            "🧠 Running Full AI Analysis...";

    }


    if (resultElement) {

        resultElement.innerHTML = `

            <div class="ai-loading-card">

                <div class="ai-loading-spinner">
                    🤖
                </div>

                <h3>
                    Running Full AI Analysis
                </h3>

                <p>
                    Gemini is analyzing your crop image,
                    current ESP32 sensor readings and recent
                    historical data.
                </p>

                <div class="ai-loading-steps">

                    <div>
                        ✓ Reading sensor data
                    </div>

                    <div>
                        ✓ Checking crop conditions
                    </div>

                    <div>
                        ✓ Preparing visual analysis
                    </div>

                    <div>
                        ⏳ Generating recommendations
                    </div>

                </div>

            </div>

        `;

    }


    try {

        // ====================================================
        // FORM DATA
        // ====================================================

        const formData =
            new FormData();


        // ----------------------------------------------------
        // Crop
        // ----------------------------------------------------

        formData.append(
            "crop",
            crop
        );


        // ----------------------------------------------------
        // Current sensor data
        // ----------------------------------------------------

        formData.append(
            "sensor_data",
            JSON.stringify(
                sensorData
            )
        );


        // ----------------------------------------------------
        // Recent history
        //
        // Send only the most recent 20 readings.
        // ----------------------------------------------------

        const recentHistory =
            Array.isArray(historyData)
                ? historyData.slice(
                    0,
                    20
                )
                : [];


        formData.append(
            "historical_readings",
            JSON.stringify(
                recentHistory
            )
        );


        // ----------------------------------------------------
        // Crop image
        // ----------------------------------------------------

        if (
            selectedCropImageFile
        ) {

            formData.append(
                "image",
                selectedCropImageFile
            );

            console.log(
                "Full AI image:",
                selectedCropImageFile.name
            );

        }
        else {

            console.log(
                "Full AI running without crop image."
            );

        }


        // ====================================================
        // DEBUG INFORMATION
        // ====================================================

        console.log(
            "========================================"
        );

        console.log(
            "FULL AI ANALYSIS REQUEST"
        );

        console.log(
            "========================================"
        );

        console.log(
            "Crop:",
            crop
        );

        console.log(
            "Sensor data:",
            sensorData
        );

        console.log(
            "History count:",
            recentHistory.length
        );

        console.log(
            "Image selected:",
            !!selectedCropImageFile
        );

        console.log(
            "========================================"
        );


        // ====================================================
        // SEND TO BACKEND
        // ====================================================

        const response =
            await fetch(
                API_BASE +
                "/api/ai/combined",
                {

                    method:
                        "POST",

                    body:
                        formData

                }
            );


        // ====================================================
        // READ RESPONSE SAFELY
        // ====================================================

        let data;


        try {

            data =
                await response.json();

        }

        catch (jsonError) {

            throw new Error(
                "Backend returned an invalid response. " +
                "Check the Flask terminal for the actual error."
            );

        }


        // ====================================================
        // CHECK RESPONSE
        // ====================================================

        if (
            !response.ok ||
            !data.success
        ) {

            throw new Error(

                data.error ||
                "Full AI Analysis failed."

            );

        }


        // ====================================================
        // STORE RESULT
        // ====================================================

        combinedAIResult =
            data.analysis ||
            null;


        // ====================================================
        // CLEAR OLD SENSOR RESULT
        // ====================================================

        healthAnalysis =
            null;


        // ====================================================
        // DEBUG RESULT
        // ====================================================

        console.log(
            "========================================"
        );

        console.log(
            "FULL AI ANALYSIS RESULT"
        );

        console.log(
            data
        );

        console.log(
            "========================================"
        );


        // ====================================================
        // DISPLAY RESULT
        // ====================================================

        displayCombinedAIResult(
            data
        );


        // ====================================================
        // UPDATE DASHBOARD STATE
        // ====================================================

        updateSensorDisplay();


        // ====================================================
        // BUTTON
        // ====================================================

        if (button) {

            button.textContent =
                "🔄 Run Full AI Analysis Again";

        }

    }

    catch (error) {

        console.error(
            "========================================"
        );

        console.error(
            "FULL AI ANALYSIS ERROR"
        );

        console.error(
            error
        );

        console.error(
            "========================================"
        );


        if (resultElement) {

            resultElement.innerHTML = `

                <div class="error-message ai-error-card">

                    <h3>
                        ❌ Full AI Analysis Failed
                    </h3>

                    <p>
                        ${escapeHTML(
                            error.message ||
                            "Unknown AI error."
                        )}
                    </p>

                    <div class="ai-error-help">

                        <strong>
                            Check:
                        </strong>

                        <ul>

                            <li>
                                Flask server is running
                            </li>

                            <li>
                                Gemini API key is valid
                            </li>

                            <li>
                                The browser console for details
                            </li>

                            <li>
                                The Flask terminal for Gemini errors
                            </li>

                        </ul>

                    </div>

                </div>

            `;

        }


        combinedAIResult =
            null;

    }

    finally {

        if (button) {

            button.disabled =
                false;


            if (!combinedAIResult) {

                button.textContent =
                    "🧠 Run Full AI Analysis";

            }

        }

    }

}


// ============================================================
// DISPLAY COMBINED AI
// ============================================================

function displayCombinedAIResult(
    data
) {

    const imageResult =
        getElement(
            "imageAIResult"
        );


    if (!imageResult) {

        return;

    }


    const analysis =
        data.analysis ||
        {};


    const overallScore =
        isValidNumber(
            analysis.overall_health_score
        )
            ? Math.round(
                Number(
                    analysis.overall_health_score
                )
            )
            : "-";


    const sensorScore =
        isValidNumber(
            analysis.sensor_health_score
        )
            ? Math.round(
                Number(
                    analysis.sensor_health_score
                )
            )
            : "-";


    const imageScore =
        isValidNumber(
            analysis.image_health_score
        )
            ? Math.round(
                Number(
                    analysis.image_health_score
                )
            )
            : "-";


    const observations =
        Array.isArray(
            analysis.visual_observations
        )
            ? analysis.visual_observations
            : [];


    const concerns =
        Array.isArray(
            analysis.possible_concerns
        )
            ? analysis.possible_concerns
            : [];


    const actions =
        Array.isArray(
            analysis.actions
        )
            ? analysis.actions
            : [];


    const observationsHTML =
        observations.length

            ? observations
                .map(
                    item =>
                        `<li>${escapeHTML(item)}</li>`
                )
                .join("")

            : "<li>No major visual observations.</li>";


    const concernsHTML =
        concerns.length

            ? concerns
                .map(
                    item =>
                        `<li>${escapeHTML(item)}</li>`
                )
                .join("")

            : "<li>No major concerns detected.</li>";


    const actionsHTML =
        actions.length

            ? actions
                .map(
                    item =>
                        `<li>${escapeHTML(item)}</li>`
                )
                .join("")

            : "<li>No specific actions returned.</li>";


    imageResult.innerHTML = `

        <div class="ai-result-card">

            <h2>
                🧠 Combined AI Crop Analysis
            </h2>

            <div class="ai-score-section">

                <h3>
                    Overall Health:
                    ${overallScore}/100
                </h3>

                <p>

                    <strong>
                        Status:
                    </strong>

                    ${escapeHTML(
                        analysis.overall_status ||
                        "-"
                    )}

                </p>

                <p>

                    <strong>
                        Stress Level:
                    </strong>

                    ${escapeHTML(
                        analysis.stress_level ||
                        "-"
                    )}

                </p>

                <p>

                    <strong>
                        Confidence:
                    </strong>

                    ${escapeHTML(
                        analysis.confidence ||
                        "-"
                    )}

                </p>

            </div>

            <div class="ai-score-breakdown">

                <p>

                    <strong>
                        Sensor Health:
                    </strong>

                    ${sensorScore}/100

                </p>

                <p>

                    <strong>
                        Image Health:
                    </strong>

                    ${imageScore}/100

                </p>

            </div>

            <div class="ai-section">

                <h3>
                    🌱 Plant Condition
                </h3>

                <p>
                    ${escapeHTML(
                        analysis.plant_condition ||
                        "-"
                    )}
                </p>

            </div>

            <div class="ai-section">

                <h3>
                    📝 Summary
                </h3>

                <p>
                    ${escapeHTML(
                        analysis.summary ||
                        "-"
                    )}
                </p>

            </div>

            <div class="ai-section">

                <h3>
                    🌍 Soil & Environment
                </h3>

                <p>

                    <strong>
                        Soil Moisture:
                    </strong>

                    ${escapeHTML(
                        analysis.soil_moisture_status ||
                        "-"
                    )}

                </p>

                <p>

                    <strong>
                        Temperature:
                    </strong>

                    ${escapeHTML(
                        analysis.temperature_status ||
                        "-"
                    )}

                </p>

                <p>

                    <strong>
                        Humidity:
                    </strong>

                    ${escapeHTML(
                        analysis.humidity_status ||
                        "-"
                    )}

                </p>

                <p>

                    <strong>
                        Nutrients:
                    </strong>

                    ${escapeHTML(
                        analysis.nutrient_status ||
                        "-"
                    )}

                </p>

            </div>

            <div class="ai-section">

                <h3>
                    💧 Water Requirement
                </h3>

                <p>

                    <strong>
                        Need:
                    </strong>

                    ${escapeHTML(
                        analysis.water_need ||
                        "-"
                    )}

                </p>

                <p>

                    <strong>
                        Recommendation:
                    </strong>

                    ${escapeHTML(
                        analysis.water_recommendation ||
                        "-"
                    )}

                </p>

            </div>

            <div class="ai-section">

                <h3>
                    🧪 Nutrient Recommendation
                </h3>

                <p>
                    ${escapeHTML(
                        analysis.nutrient_recommendation ||
                        "-"
                    )}
                </p>

            </div>

            <div class="ai-section">

                <h3>
                    👁️ Visual Observations
                </h3>

                <ul>
                    ${observationsHTML}
                </ul>

            </div>

            <div class="ai-section">

                <h3>
                    ⚠️ Possible Concerns
                </h3>

                <ul>
                    ${concernsHTML}
                </ul>

            </div>

            <div class="ai-section">

                <h3>
                    ✅ Recommended Actions
                </h3>

                <ul>
                    ${actionsHTML}
                </ul>

            </div>

            <div class="ai-data-source">

                <p>

                    <strong>
                        Crop:
                    </strong>

                    ${escapeHTML(
                        data.crop ||
                        "-"
                    )}

                </p>

                <p>

                    <strong>
                        Historical Readings:
                    </strong>

                    ${data.historical_count ?? 0}

                </p>

                <p>

                    <strong>
                        Image Used:
                    </strong>

                    ${
                        data.image_used
                            ? "Yes"
                            : "No"
                    }

                </p>

            </div>

        </div>

    `;

}


// ============================================================
// HISTORY FILTERS
// ============================================================

function initializeHistoryFilters() {

    const searchButton =
        getElement(
            "historySearchButton"
        );


    const todayButton =
        getElement(
            "historyTodayButton"
        );


    if (searchButton) {

        searchButton.addEventListener(
            "click",
            async function () {

                const date =
                    getElement(
                        "historyDate"
                    )?.value || "";


                const start =
                    getElement(
                        "historyStart"
                    )?.value || "";


                const end =
                    getElement(
                        "historyEnd"
                    )?.value || "";


                historySelectedDate =
                    date;


                historyStartTime =
                    start;


                historyEndTime =
                    end;


                historyOffset =
                    0;


                historyPage =
                    1;


                setText(
                    "historyStatus",
                    "Searching..."
                );


                await fetchHistory(
                    HISTORY_PAGE_SIZE,
                    date,
                    start,
                    end,
                    0
                );

            }
        );

    }


    if (todayButton) {

        todayButton.addEventListener(
            "click",
            async function () {

                const today =
                    getTodayLocalDate();


                const dateInput =
                    getElement(
                        "historyDate"
                    );


                const startInput =
                    getElement(
                        "historyStart"
                    );


                const endInput =
                    getElement(
                        "historyEnd"
                    );


                if (dateInput) {

                    dateInput.value =
                        today;

                }


                if (startInput) {

                    startInput.value =
                        "";

                }


                if (endInput) {

                    endInput.value =
                        "";

                }


                historySelectedDate =
                    today;


                historyStartTime =
                    "";


                historyEndTime =
                    "";


                historyOffset =
                    0;


                historyPage =
                    1;


                setText(
                    "historyStatus",
                    "Loading today..."
                );


                await fetchHistory(
                    HISTORY_PAGE_SIZE,
                    today,
                    "",
                    "",
                    0
                );

            }
        );

    }

}


// ============================================================
// SMART ALERT HELPERS
// ============================================================

function getCropWaterThresholds(
    crop
) {

    const normalized =
        String(
            crop || ""
        )
        .trim()
        .toLowerCase();


    const defaults = {

        low:
            35,

        critical:
            25,

        optimalLow:
            40,

        optimalHigh:
            80

    };


    const cropProfiles = {

        tomato: {

            low:
                38,

            critical:
                28,

            optimalLow:
                45,

            optimalHigh:
                75

        },

        rice: {

            low:
                45,

            critical:
                32,

            optimalLow:
                50,

            optimalHigh:
                85

        },

        maize: {

            low:
                35,

            critical:
                25,

            optimalLow:
                40,

            optimalHigh:
                75

        },

        corn: {

            low:
                35,

            critical:
                25,

            optimalLow:
                40,

            optimalHigh:
                75

        },

        wheat: {

            low:
                35,

            critical:
                25,

            optimalLow:
                40,

            optimalHigh:
                70

        },

        potato: {

            low:
                40,

            critical:
                30,

            optimalLow:
                45,

            optimalHigh:
                75

        },

        cotton: {

            low:
                32,

            critical:
                22,

            optimalLow:
                38,

            optimalHigh:
                72

        }

    };


    return {

        ...defaults,

        ...(
            cropProfiles[
                normalized
            ] || {}
        )

    };

}


// ============================================================
// BUILD SMART ALERTS
// ============================================================

function buildSmartAlerts() {

    const alerts = [];


    if (!sensorReady) {

        return alerts;

    }


    const moisture =
        Number(
            sensorData.moisture
        );


    const temperature =
        Number(
            sensorData.temperature
        );


    const humidity =
        Number(
            sensorData.humidity
        );


    const nitrogen =
        Number(
            sensorData.nitrogen
        );


    const phosphorus =
        Number(
            sensorData.phosphorus
        );


    const potassium =
        Number(
            sensorData.potassium
        );


    const crop =
        getSelectedCrop();


    const moistureThresholds =
        getCropWaterThresholds(
            crop
        );


    // --------------------------------------------------------
    // MOISTURE
    // --------------------------------------------------------

    if (
        Number.isFinite(
            moisture
        )
    ) {

        if (
            moisture <=
            moistureThresholds.critical
        ) {

            alerts.push({

                severity:
                    "critical",

                icon:
                    "🚨",

                title:
                    "Critical Soil Moisture",

                message:
                    `Soil moisture is ${formatNumber(moisture)}%. ${crop} may require irrigation immediately.`,

                action:
                    "Irrigate as soon as practical."

            });

        }

        else if (
            moisture <
            moistureThresholds.low
        ) {

            alerts.push({

                severity:
                    "warning",

                icon:
                    "💧",

                title:
                    "Low Soil Moisture",

                message:
                    `Soil moisture is ${formatNumber(moisture)}%. The crop may be entering water stress.`,

                action:
                    "Consider irrigation soon."

            });

        }

        else if (
            moisture >
            moistureThresholds.optimalHigh
        ) {

            alerts.push({

                severity:
                    "warning",

                icon:
                    "🌊",

                title:
                    "High Soil Moisture",

                message:
                    `Soil moisture is ${formatNumber(moisture)}%. Excess water may increase root-zone stress.`,

                action:
                    "Avoid unnecessary irrigation and check drainage."

            });

        }

    }


    // --------------------------------------------------------
    // TEMPERATURE
    // --------------------------------------------------------

    if (
        Number.isFinite(
            temperature
        )
    ) {

        if (
            temperature >= 38
        ) {

            alerts.push({

                severity:
                    "critical",

                icon:
                    "🌡️",

                title:
                    "High Temperature",

                message:
                    `Temperature has reached ${formatNumber(temperature)}°C.`,

                action:
                    "Monitor crop heat stress and irrigation demand."

            });

        }

        else if (
            temperature >= 33
        ) {

            alerts.push({

                severity:
                    "warning",

                icon:
                    "🌡️",

                title:
                    "Elevated Temperature",

                message:
                    `Temperature is ${formatNumber(temperature)}°C.`,

                action:
                    "Watch moisture closely because water demand may increase."

            });

        }

        else if (
            temperature < 12
        ) {

            alerts.push({

                severity:
                    "warning",

                icon:
                    "🥶",

                title:
                    "Low Temperature",

                message:
                    `Temperature is ${formatNumber(temperature)}°C.`,

                action:
                    "Monitor the crop for cold stress."

            });

        }

    }


    // --------------------------------------------------------
    // HUMIDITY
    // --------------------------------------------------------

    if (
        Number.isFinite(
            humidity
        )
    ) {

        if (
            humidity >= 90
        ) {

            alerts.push({

                severity:
                    "warning",

                icon:
                    "💦",

                title:
                    "Very High Humidity",

                message:
                    `Humidity is ${formatNumber(humidity)}%.`,

                action:
                    "Watch for prolonged leaf wetness and fungal-risk conditions."

            });

        }

        else if (
            humidity < 30
        ) {

            alerts.push({

                severity:
                    "warning",

                icon:
                    "🏜️",

                title:
                    "Low Humidity",

                message:
                    `Humidity is ${formatNumber(humidity)}%.`,

                action:
                    "Monitor plant water demand and soil moisture."

            });

        }

    }


    // --------------------------------------------------------
    // NITROGEN
    // --------------------------------------------------------

    if (
        Number.isFinite(
            nitrogen
        ) &&
        nitrogen < 30
    ) {

        alerts.push({

            severity:
                "warning",

            icon:
                "🧪",

            title:
                "Low Nitrogen",

            message:
                `Nitrogen reading is ${formatNumber(nitrogen)}.`,

            action:
                "Review nitrogen availability before applying fertilizer."

        });

    }


    // --------------------------------------------------------
    // PHOSPHORUS
    // --------------------------------------------------------

    if (
        Number.isFinite(
            phosphorus
        ) &&
        phosphorus < 30
    ) {

        alerts.push({

            severity:
                "warning",

            icon:
                "🧪",

            title:
                "Low Phosphorus",

            message:
                `Phosphorus reading is ${formatNumber(phosphorus)}.`,

            action:
                "Review phosphorus availability and crop requirements."

        });

    }


    // --------------------------------------------------------
    // POTASSIUM
    // --------------------------------------------------------

    if (
        Number.isFinite(
            potassium
        ) &&
        potassium < 30
    ) {

        alerts.push({

            severity:
                "warning",

            icon:
                "🧪",

            title:
                "Low Potassium",

            message:
                `Potassium reading is ${formatNumber(potassium)}.`,

            action:
                "Review potassium availability and crop requirements."

        });

    }


    // --------------------------------------------------------
    // SENSOR CONNECTION
    // --------------------------------------------------------

    if (
        !esp32Connected
    ) {

        alerts.push({

            severity:
                "info",

            icon:
                "📡",

            title:
                "ESP32 Not Connected",

            message:
                "The ESP32 is not currently reporting as live.",

            action:
                "Check the ESP32 power, Wi-Fi and Flask connection."

        });

    }


    return alerts;

}


// ============================================================
// IRRIGATION RECOMMENDATION
// ============================================================

function calculateIrrigationRecommendation() {

    if (!sensorReady) {

        return {

            level:
                "unknown",

            icon:
                "💧",

            title:
                "Waiting for Sensor Data",

            message:
                "Irrigation recommendation will appear when valid sensor readings are available.",

            score:
                0,

            reasons:
                []

        };

    }


    const moisture =
        Number(
            sensorData.moisture
        );


    const temperature =
        Number(
            sensorData.temperature
        );


    const humidity =
        Number(
            sensorData.humidity
        );


    const crop =
        getSelectedCrop();


    const thresholds =
        getCropWaterThresholds(
            crop
        );


    let score =
        0;


    const reasons =
        [];


    // Moisture is the primary signal.

    if (
        Number.isFinite(
            moisture
        )
    ) {

        if (
            moisture <=
            thresholds.critical
        ) {

            score +=
                70;

            reasons.push(
                `Soil moisture is critically low at ${formatNumber(moisture)}%.`
            );

        }

        else if (
            moisture <
            thresholds.low
        ) {

            score +=
                50;

            reasons.push(
                `Soil moisture is below the preferred range at ${formatNumber(moisture)}%.`
            );

        }

        else if (
            moisture <
            thresholds.optimalLow
        ) {

            score +=
                25;

            reasons.push(
                `Soil moisture is slightly below the preferred ${crop} range.`
            );

        }

        else if (
            moisture >
            thresholds.optimalHigh
        ) {

            score -=
                50;

            reasons.push(
                "Soil moisture is already high."
            );

        }

    }


    // High temperature increases water demand.

    if (
        Number.isFinite(
            temperature
        ) &&
        temperature >= 33
    ) {

        score +=
            15;

        reasons.push(
            `Temperature is elevated at ${formatNumber(temperature)}°C.`
        );

    }


    // Low humidity increases water demand.

    if (
        Number.isFinite(
            humidity
        ) &&
        humidity < 35
    ) {

        score +=
            10;

        reasons.push(
            `Humidity is low at ${formatNumber(humidity)}%.`
        );

    }


    score =
        clamp(
            score,
            0,
            100
        );


    let level =
        "none";


    let icon =
        "🟢";


    let title =
        "Irrigation Not Required";


    let message =
        `Current conditions do not indicate an immediate need for irrigation for ${crop}.`;


    if (
        score >= 70
    ) {

        level =
            "urgent";

        icon =
            "🚨";

        title =
            "Immediate Irrigation Recommended";

        message =
            `The current conditions indicate significant water demand for ${crop}.`;

    }

    else if (
        score >= 40
    ) {

        level =
            "soon";

        icon =
            "💧";

        title =
            "Irrigation Recommended Soon";

        message =
            `Soil conditions suggest that irrigation should be considered soon.`;

    }

    else if (
        score >= 20
    ) {

        level =
            "watch";

        icon =
            "🟡";

        title =
            "Monitor Soil Moisture";

        message =
            `Irrigation is not immediately required, but moisture should be monitored.`;

    }


    return {

        level,

        icon,

        title,

        message,

        score,

        reasons

    };

}


// ============================================================
// SMART MONITORING HTML
// ============================================================

function ensureSmartMonitoringPanel() {

    const alertsPage =
        getElement(
            "alerts"
        );


    if (!alertsPage) {

        return null;

    }


    let panel =
        getElement(
            "smartMonitoringPanel"
        );


    if (panel) {

        return panel;

    }


    panel =
        document.createElement(
            "div"
        );


    panel.id =
        "smartMonitoringPanel";


    panel.style.marginBottom =
        "18px";


    alertsPage
        .querySelector(
            ".page-header"
        )
        ?.insertAdjacentElement(
            "afterend",
            panel
        );


    return panel;

}

// ============================================================
// LIVE ALERT INDICATOR
// ============================================================

function updateAlertIndicator() {

    const button =
        getElement("alertBellButton");

    const icon =
        getElement("alertBellIcon");

    const badge =
        getElement("alertBellBadge");

    if (!button) {
        return;
    }

    const alerts =
        Array.isArray(smartAlerts)
            ? smartAlerts
            : [];

    const criticalCount =
        alerts.filter(
            alert =>
                alert.severity === "critical"
        ).length;

    const warningCount =
        alerts.filter(
            alert =>
                alert.severity === "warning"
        ).length;

    const totalCount =
        alerts.length;

    button.classList.remove(
        "has-warning",
        "has-critical"
    );

    if (totalCount === 0) {

        if (icon) {
            icon.textContent = "🔔";
        }

        if (badge) {
            badge.textContent = "0";
            badge.style.display = "none";
        }

        button.title =
            "No active farm alerts";

        button.setAttribute(
            "aria-label",
            "No active farm alerts"
        );

        return;
    }

    if (criticalCount > 0) {

        button.classList.add(
            "has-critical"
        );

        if (icon) {
            icon.textContent = "🚨";
        }

        button.title =
            criticalCount +
            " critical farm alert" +
            (criticalCount > 1 ? "s" : "");

        button.setAttribute(
            "aria-label",
            criticalCount +
            " critical farm alert" +
            (criticalCount > 1 ? "s" : "")
        );

    }

    else {

        button.classList.add(
            "has-warning"
        );

        if (icon) {
            icon.textContent = "⚠️";
        }

        button.title =
            warningCount +
            " farm warning" +
            (warningCount > 1 ? "s" : "");

        button.setAttribute(
            "aria-label",
            warningCount +
            " farm warning" +
            (warningCount > 1 ? "s" : "")
        );
    }

    if (badge) {

        badge.textContent =
            totalCount > 99
                ? "99+"
                : String(totalCount);

        badge.style.display =
            "flex";

        badge.style.alignItems =
            "center";

        badge.style.justifyContent =
            "center";
    }
}


// ============================================================
// ALERT BUTTON NAVIGATION
// ============================================================

function initializeAlertIndicator() {

    const button =
        getElement("alertBellButton");

    if (!button) {
        return;
    }

    if (
        button.dataset.bound ===
        "true"
    ) {
        return;
    }

    button.dataset.bound =
        "true";

    button.addEventListener(
        "click",
        function () {

            const alertsNav =
                document.querySelector(
                    '[data-page="alerts"]'
                );

            if (alertsNav) {
                alertsNav.click();
            }

            setTimeout(
                function () {

                    const panel =
                        getElement(
                            "smartMonitoringPanel"
                        );

                    if (panel) {

                        panel.scrollIntoView({
                            behavior: "smooth",
                            block: "start"
                        });

                    }

                },
                150
            );
        }
    );

    updateAlertIndicator();
}


// ============================================================
// SMART MONITORING PANEL
// ============================================================

function updateSmartMonitoring() {

    const panel =
        ensureSmartMonitoringPanel();


    if (!panel) {

        return;

    }


    smartAlerts =
        buildSmartAlerts();


    irrigationRecommendation =
        calculateIrrigationRecommendation();

    updateAlertIndicator();


    const crop =
        getSelectedCrop();


    const criticalCount =
        smartAlerts.filter(
            alert =>
                alert.severity ===
                "critical"
        ).length;


    const warningCount =
        smartAlerts.filter(
            alert =>
                alert.severity ===
                "warning"
        ).length;


    let overallState =
        "normal";


    if (
        criticalCount > 0
    ) {

        overallState =
            "critical";

    }

    else if (
        warningCount > 0
    ) {

        overallState =
            "warning";

    }


    const stateBackground =

        overallState === "critical"
            ? "#fff1f1"

            : overallState === "warning"
                ? "#fff9ec"

                : "#f0faf4";


    const stateBorder =

        overallState === "critical"
            ? "#f1caca"

            : overallState === "warning"
                ? "#efdca9"

                : "#cfe8d7";


    const stateText =

        overallState === "critical"
            ? "#9d2929"

            : overallState === "warning"
                ? "#805900"

                : "#247246";


    let irrigationBackground =
        "#f0faf4";


    let irrigationBorder =
        "#cfe8d7";


    let irrigationText =
        "#247246";


    if (
        irrigationRecommendation.level ===
        "urgent"
    ) {

        irrigationBackground =
            "#fff1f1";

        irrigationBorder =
            "#f1caca";

        irrigationText =
            "#9d2929";

    }

    else if (
        irrigationRecommendation.level ===
        "soon"
    ) {

        irrigationBackground =
            "#fff9ec";

        irrigationBorder =
            "#efdca9";

        irrigationText =
            "#805900";

    }


    const alertsHTML =
        smartAlerts.length

            ? smartAlerts
                .slice(
                    0,
                    6
                )
                .map(
                    alert => {

                        const background =

                            alert.severity ===
                            "critical"
                                ? "#fff1f1"

                                : alert.severity ===
                                  "warning"
                                    ? "#fff9ec"
                                    : "#f1f6ff";


                        const border =

                            alert.severity ===
                            "critical"
                                ? "#f1caca"

                                : alert.severity ===
                                  "warning"
                                    ? "#efdca9"
                                    : "#d3e0ef";


                        return `

                            <div
                                style="
                                    background:${background};
                                    border:1px solid ${border};
                                    border-radius:12px;
                                    padding:13px;
                                    display:flex;
                                    gap:11px;
                                    align-items:flex-start;
                                "
                            >

                                <div
                                    style="
                                        font-size:20px;
                                        line-height:1;
                                    "
                                >
                                    ${alert.icon}
                                </div>

                                <div>

                                    <strong
                                        style="
                                            display:block;
                                            margin-bottom:3px;
                                            color:#26352d;
                                            font-size:12px;
                                        "
                                    >
                                        ${escapeHTML(
                                            alert.title
                                        )}
                                    </strong>

                                    <div
                                        style="
                                            color:#607068;
                                            font-size:10px;
                                            line-height:1.55;
                                        "
                                    >
                                        ${escapeHTML(
                                            alert.message
                                        )}
                                    </div>

                                    <div
                                        style="
                                            margin-top:5px;
                                            color:#687970;
                                            font-size:9px;
                                        "
                                    >
                                        ${escapeHTML(
                                            alert.action
                                        )}
                                    </div>

                                </div>

                            </div>

                        `;

                    }
                )
                .join("")

            : `

                <div
                    style="
                        padding:13px;
                        border:1px solid #cfe8d7;
                        background:#f0faf4;
                        border-radius:12px;
                        color:#247246;
                        font-size:10px;
                    "
                >
                    🟢 No active sensor alerts. Current conditions are within the monitoring thresholds.
                </div>

            `;


    const reasonsHTML =
        irrigationRecommendation.reasons.length

            ? irrigationRecommendation.reasons
                .map(
                    reason =>
                        `<li>${escapeHTML(reason)}</li>`
                )
                .join("")

            : "<li>Current sensor conditions are stable.</li>";


    panel.innerHTML = `

        <div
            style="
                background:#ffffff;
                border:1px solid #dfe8e2;
                border-radius:14px;
                padding:18px;
                box-shadow:0 5px 18px rgba(36,65,49,.06);
            "
        >

            <div
                style="
                    display:flex;
                    justify-content:space-between;
                    align-items:flex-start;
                    gap:15px;
                    flex-wrap:wrap;
                    margin-bottom:15px;
                "
            >

                <div>

                    <span
                        style="
                            display:block;
                            color:#6d7c74;
                            font-size:8px;
                            font-weight:800;
                            letter-spacing:.8px;
                            margin-bottom:4px;
                        "
                    >
                        LIVE SMART MONITORING
                    </span>

                    <h2
                        style="
                            margin:0;
                            font-size:16px;
                            color:#25342c;
                        "
                    >
                        🌱 Farm Decision Center
                    </h2>

                    <p
                        style="
                            margin:5px 0 0;
                            color:#708078;
                            font-size:10px;
                        "
                    >
                        Crop: ${escapeHTML(crop)}
                        •
                        ESP32: ${
                            esp32Connected
                                ? "Live"
                                : "Demo / Offline"
                        }
                    </p>

                </div>

                <div
                    style="
                        padding:7px 10px;
                        border-radius:999px;
                        background:${stateBackground};
                        border:1px solid ${stateBorder};
                        color:${stateText};
                        font-size:9px;
                        font-weight:800;
                        white-space:nowrap;
                    "
                >
                    ${
                        overallState === "critical"
                            ? "🔴 CRITICAL"
                            : overallState === "warning"
                                ? "🟡 ATTENTION"
                                : "🟢 NORMAL"
                    }
                </div>

            </div>


            <div
                style="
                    display:grid;
                    grid-template-columns:repeat(auto-fit,minmax(240px,1fr));
                    gap:12px;
                "
            >

                <div
                    style="
                        background:${irrigationBackground};
                        border:1px solid ${irrigationBorder};
                        border-radius:12px;
                        padding:15px;
                    "
                >

                    <div
                        style="
                            font-size:9px;
                            font-weight:800;
                            color:${irrigationText};
                            letter-spacing:.6px;
                            margin-bottom:7px;
                        "
                    >
                        💧 IRRIGATION RECOMMENDATION
                    </div>

                    <h3
                        style="
                            margin:0 0 5px;
                            font-size:14px;
                            color:${irrigationText};
                        "
                    >
                        ${irrigationRecommendation.icon}
                        ${escapeHTML(
                            irrigationRecommendation.title
                        )}
                    </h3>

                    <p
                        style="
                            margin:0;
                            color:#617068;
                            font-size:10px;
                            line-height:1.55;
                        "
                    >
                        ${escapeHTML(
                            irrigationRecommendation.message
                        )}
                    </p>

                    <div
                        style="
                            margin-top:9px;
                            height:7px;
                            background:#e4ebe6;
                            border-radius:999px;
                            overflow:hidden;
                        "
                    >

                        <div
                            style="
                                width:${irrigationRecommendation.score}%;
                                height:100%;
                                background:${irrigationText};
                                border-radius:999px;
                                transition:width .3s ease;
                            "
                        ></div>

                    </div>

                    <div
                        style="
                            margin-top:5px;
                            font-size:8px;
                            color:#738178;
                        "
                    >
                        Water-demand score:
                        ${irrigationRecommendation.score}/100
                    </div>

                    <ul
                        style="
                            margin:9px 0 0;
                            padding-left:17px;
                            color:#66756d;
                            font-size:9px;
                            line-height:1.6;
                        "
                    >
                        ${reasonsHTML}
                    </ul>

                </div>


                <div
                    style="
                        background:${stateBackground};
                        border:1px solid ${stateBorder};
                        border-radius:12px;
                        padding:15px;
                    "
                >

                    <div
                        style="
                            font-size:9px;
                            font-weight:800;
                            color:${stateText};
                            letter-spacing:.6px;
                            margin-bottom:7px;
                        "
                    >
                        🚨 ACTIVE SENSOR ALERTS
                    </div>

                    <div
                        style="
                            display:flex;
                            gap:8px;
                            margin-bottom:10px;
                            flex-wrap:wrap;
                        "
                    >

                        <span
                            style="
                                padding:5px 8px;
                                border-radius:999px;
                                background:#fff;
                                color:#9d2929;
                                font-size:8px;
                                font-weight:800;
                            "
                        >
                            ${criticalCount}
                            Critical
                        </span>

                        <span
                            style="
                                padding:5px 8px;
                                border-radius:999px;
                                background:#fff;
                                color:#805900;
                                font-size:8px;
                                font-weight:800;
                            "
                        >
                            ${warningCount}
                            Warning
                        </span>

                        <span
                            style="
                                padding:5px 8px;
                                border-radius:999px;
                                background:#fff;
                                color:#527065;
                                font-size:8px;
                                font-weight:800;
                            "
                        >
                            ${smartAlerts.length}
                            Total
                        </span>

                    </div>

                    <div
                        style="
                            display:flex;
                            flex-direction:column;
                            gap:7px;
                        "
                    >

                        ${alertsHTML}

                    </div>

                </div>

            </div>

        </div>

    `;


    const signature =
        smartAlerts
            .map(
                alert =>
                    `${alert.severity}:${alert.title}`
            )
            .join("|") +
        "|" +
        irrigationRecommendation.level;


    if (
        lastSmartAlertSignature &&
        signature !==
        lastSmartAlertSignature
    ) {

        const critical =
            smartAlerts.find(
                alert =>
                    alert.severity ===
                    "critical"
            );


        if (critical) {

            showToast(
                critical.title +
                ": " +
                critical.message,
                "danger"
            );

        }

        else if (
            irrigationRecommendation.level ===
            "urgent"
        ) {

            showToast(
                "Immediate irrigation is recommended.",
                "danger"
            );

        }

        else if (
            warningCount > 0
        ) {

            showToast(
                `${warningCount} smart farm warning${warningCount > 1 ? "s" : ""} detected.`,
                "warning"
            );

        }

    }


    lastSmartAlertSignature =
        signature;

}


// ============================================================
// HISTORY FILTER KEYBOARD SUPPORT
// ============================================================

function initializeHistoryKeyboard() {

    document.addEventListener(
        "keydown",
        async function (event) {

            const historyPageElement =
                getElement(
                    "history"
                );


            if (
                !historyPageElement ||
                !historyPageElement.classList.contains(
                    "active-page"
                )
            ) {

                return;

            }


            if (
                event.key ===
                "ArrowLeft"
            ) {

                const previousButton =
                    getElement(
                        "historyPrevButton"
                    );


                if (
                    previousButton &&
                    !previousButton.disabled
                ) {

                    previousButton.click();

                }

            }


            if (
                event.key ===
                "ArrowRight"
            ) {

                const nextButton =
                    getElement(
                        "historyNextButton"
                    );


                if (
                    nextButton &&
                    !nextButton.disabled
                ) {

                    nextButton.click();

                }

            }

        }
    );

}


// ============================================================
// AUTO REFRESH
// ============================================================

function initializeAutoRefresh() {

    // --------------------------------------------------------
    // Sensor + status refresh
    // --------------------------------------------------------

    setInterval(
        async function () {

            await fetchSensorData();

            await checkESP32Status();

            await fetchCropHealth();

            updateSmartMonitoring();

        },
        5000
    );


    // --------------------------------------------------------
    // History refresh
    // --------------------------------------------------------

    setInterval(
        async function () {

            if (
                historyLoading
            ) {

                return;

            }


            await fetchHistory(
                HISTORY_PAGE_SIZE,
                historySelectedDate,
                historyStartTime,
                historyEndTime,
                historyOffset
            );

        },
        30000
    );

}


// ============================================================
// APPLICATION START
// ============================================================

async function startApplication() {

    console.log(
        "======================================"
    );


    console.log(
        "🌱 AgriAI Dashboard Starting..."
    );


    console.log(
        "======================================"
    );


    // --------------------------------------------------------
    // Initialize UI
    // --------------------------------------------------------

    initializeNavigation();

    initializeAlertIndicator();

    initializeMenu();

    initializeClock();

    initializeCropSettings();

    initializeDataSource();

    initializeImageUpload();

    initializeAI();

    initializeCharts();

    initializeHistoryFilters();

    initializeHistoryPagination();

    initializeHistoryKeyboard();

    initializeCombinedAI();


    // --------------------------------------------------------
    // Initial data
    // --------------------------------------------------------

    await fetchSensorData();

    await fetchSystemStatus();

    await checkESP32Status();

    await fetchCropHealth();


    await fetchHistory(
        HISTORY_PAGE_SIZE,
        "",
        "",
        "",
        0
    );


    await fetchDatabaseStatsFallback();


    updateSmartMonitoring();


    // --------------------------------------------------------
    // Auto refresh
    // --------------------------------------------------------

    initializeAutoRefresh();


    console.log(
        "======================================"
    );


    console.log(
        "✅ AgriAI Dashboard Ready!"
    );


    console.log(
        "======================================"
    );

}


// ============================================================
// DOM READY
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    startApplication
);