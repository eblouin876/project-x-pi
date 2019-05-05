class Response {

    // Method that parses the response and returns it as an array
    parseResponse(response) { }

    // Method that handles checking the status
    checkStatus(status) { }

    // Method that handles interpreting the data based on what command was received **Data passed in as obj** 
    getData(data) { }

    // Mehod that verifies the checksum to make sure it is correct
    verifyChecksum(response, checksum) { }

    static handleResponse(response) { }
}