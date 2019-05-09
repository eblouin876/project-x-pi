class Response {

    constructor(deviceId) {
        this.deviceId = deviceId;
        this.companyId = 123;
        this.version = 1;
    }

    handle(response) {
        if (!this._verifyChecksum(response)) return "Checksum Error";
        let respArr = this._parseResponse(response);
        if (respArr[1] !== this.version || respArr[2] !== this.companyId || respArr[3] !== this.deviceId) return "Invalid response";
        if (respArr[5] !== 0) return `An error occurred. Received: ${respArr[5]}`;
        return this._getData(respArr[4], respArr[6], respArr[7])
    }

    // Method that parses the response and returns it as an array
    _parseResponse(response) {
        const respArr = response.split("~");
        if (respArr.length > 7) {
            let data = [];
            for (let i = 7; i < respArr.length - 7; i++) {
                data.push(respArr[i])
            }
            respArr.length = 7;
            respArr.push(data);
        }
        return respArr
    }

    // Method that handles interpreting the data based on what command was received **Data passed in as obj**
    _getData(command, config, data) {
        switch (command) {
            case 1:
                // reportSensors
                return this._parseConfig(config, data);
            case 3:
                // start/stopWater
                return `Pump status: ${this._parseConfig(config, data)}`;
            case 4:
                // setDeviceId
                return "Device id set";
            case 5:
                // getSystemConfig
                return this._parseConfig(config, data);
            default:
                return "Received an invalid command"
        }
    }

    _parseConfig(config, data) {
        let dataIndex = 0;
        let parsedData = {};
        for (let i = 0; i < 8; i++) {
            if (config && (1 << i)) {
                switch (1 << i) {
                    case 1:
                        dataIndex++;
                        parsedData.pumpStatus = data[dataIndex];
                        break;
                    case 2:
                        dataIndex++;
                        parsedData.moisture = data[dataIndex];
                        break;
                    case 4:
                        dataIndex++;
                        parsedData.humidity = data[dataIndex];
                        break;
                    case 8:
                        dataIndex++;
                        parsedData.temperature = data[dataIndex];
                        break;
                    case 16:
                        dataIndex++;
                        parsedData.lightPin = data[dataIndex];
                        break;
                    default:
                        break;
                }
            }
        }
        return parsedData
    }

    // Method that verifies the checksum to make sure it is correct
    _verifyChecksum(response) {
        let respArr = response.split("~").map(a => parseInt(a));
        let checkSum = respArr.shift();
        let tmpSum = respArr.reduce((a, b) => a + b);
        return checkSum === tmpSum;
    }
}