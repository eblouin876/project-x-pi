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
        if (!check[0]) return [1, `Checksum Error: Expected ${check[1]}, got ${check[2]}`];
        let respArr = this._parseResponse(response);
        if (parseInt(respArr[1]) !== this.version || parseInt(respArr[2]) !== this.companyId) return [1, "Invalid response"];
        if (parseInt(respArr[5]) !== 0) return [1, `An error occurred. Received: ${respArr[5]}`];
        return [0, this._getData(respArr[4], respArr[6], respArr[7])]
    }

    // Method that parses the response and returns it as an array
    _parseResponse(response) {
        // Removes the first < and generates an array  splitting at the ~
        const respArr = response.split("~");
        // If the response contains data, it  makes an array out of the data
        if (respArr.length > 7) {
            let data = [];
            for (let i = 7; i < respArr.length - 1; i++) {
                data.push(respArr[i])
            }
            // truncates the initial array and adds the data array to the end of it
            respArr.length = 7;
            respArr.push(data);
        }
        console.log("RESPONSE ARRAY: ",respArr);
        return respArr
    }

    // Method that handles interpreting the data based on what command was received **Data passed in as obj**
    _getData(command, config, data) {
        switch (parseInt(command)) {
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
        console.log("DATA FROM ARD:", data);
        for (let i = 0; i < 8; i++) {
            // Bit sifts through config and checks each of the bytes
            if (config && (1 << i)) {
                switch (1 << i) {
                    case 1:
                        parsedData.pumpStatus = data[dataIndex];
                        dataIndex++;
                        break;
                    case 2:
                        parsedData.moisture = data[dataIndex];
                        dataIndex++;
                        break;
                    case 4:
                        parsedData.humidity = data[dataIndex];
                        dataIndex++;
                        break;
                    case 8:
                        parsedData.temperature = data[dataIndex];
                        dataIndex++;
                        break;
                    case 16:
                        parsedData.lightPin = data[dataIndex];
                        dataIndex++;
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
        let respArr = response.split("~");
        // removes the checksum from the array
        let checkSum = respArr.shift();
        respArr = respArr.filter(a => {if(a) return a});
        // sums the remaining values in the array and stores as a temporary sum
        let tmpSum = respArr.reduce((a, b) => parseInt(a) + parseInt(b));
        // returns a boolean checking the checkSum and tmpSum against each other
        return [parseInt(checkSum) === tmpSum, checkSum, tmpSum];
    }
}

module.exports = Response;