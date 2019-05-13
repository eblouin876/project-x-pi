class Response {

    constructor(deviceId) {
        this.deviceId = deviceId;
        this.companyId = 123;
        this.version = 1;
    }

    /**
     *
     * @param {String} response The string returned from the arduino to be parsed
     * @description Main method  that handles  parsing and returning the data from  the arduino
     * @returns {string|*|string}
     */
    handle(response) {
        let check = this._verifyChecksum(response);
        if (!check[0]) return `Checksum Error: Expected ${check[1]}, got ${check[2]}`;
        let respArr = this._parseResponse(response);
        if (respArr[1] !== this.version || respArr[2] !== this.companyId || respArr[3] !== this.deviceId) return "Invalid response";
        if (respArr[5] !== 0) return `An error occurred. Received: ${respArr[5]}`;
        return this._getData(respArr[4], respArr[6], respArr[7])
    }

    // Method that parses the response and returns it as an array
    _parseResponse(response) {
        // Removes the first < and generates an array  splitting at the ~
        const respArr = response.splice(1).split("~");
        // If the response contains data, it  makes an array out of the data
        if (respArr.length > 7) {
            let data = [];
            for (let i = 7; i < respArr.length - 7; i++) {
                data.push(respArr[i])
            }
            // truncates the initial array and adds the data array to the end of it
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
            // Bit sifts through config and checks each of the bytes
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
        //  Removes the first < character, splits to an array, and makes all values an int
        let respArr = response.slice(1).split("~").map(a => parseInt(a));
        // removes the checksum from the array
        let checkSum = respArr.shift();
        // sums the remaining values in the array and stores as a temporary sum
        let tmpSum = respArr.reduce((a, b) => a + b);
        // returns a boolean checking the checkSum and tmpSum against each other
        return [checkSum === tmpSum, checkSum, tmpSum];
    }
}

module.exports = Response;