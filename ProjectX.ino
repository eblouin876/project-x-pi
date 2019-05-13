#include <SoftwareSerial.h>
#include <EEPROM.h>

// DEBUG
#define DEBUG false


// Company ID
#define COMPANYID 123
#define VERSION   1

// Device ID(s) - EEPROM/Flash locations
#define DEVICE_ID_INDEX      0
#define COMPANY_ID_INDEX     2
#define SENSOR_CONFIG        4

#define LOW_MOISTURE_VAL     6
#define HI_MOISTURE_VAL      8
#define LOW_HUMIDITY_VAL    10
#define HI_HUMIDITY_VAL     12
#define LOW_TEMP_VAL        14
#define HI_TEMP_VAL         16
#define LOW_LIGHT_VAL       18
#define HI_LIGHT_VAL        20


// Device sensor binary positions
#define NUMBER_OF_SENSORS 5  //# of sensors listed below
const byte PUMP       =   1;
const byte MOISTURE   =   2;
const byte HUMIDITY   =   4;
const byte TEMPERATURE =  8;
const byte LIGHT      =  16;


// maximum serial buffer size
#define MAX_SIZE 100

// min Command length used as a check
#define MIN_CMD_LENGTH  5

// used to create command or response data struct
#define CMD   0
#define RESP  1


// maximum data size of a command data section
#define MAX_DATA 10

// define ACK/NACK
#define  ACK    0
#define  NACK   1

// define Aruduino commands
#define RPT_SENSORS         1
#define RPT_SENSOR          2
#define SET_SENSOR          3
#define SET_DEVICE_ID       4
#define RPT_SYSTEM_STATUS   5

// define Error messages larger value than largest command
const byte CHECKSUM_ERR = 127;
const byte CMD_ERROR =  128;


// keep track of pump status, OFF = 0, ON = 1
int pumpStatus = 0;

// define incoming COMMAND structure
typedef struct
{
  int checkSum;
  int ver;
  int companyId;
  int deviceId;
  int command;
  int data[MAX_DATA];
} cmdCommand;


// define COMMAND Response structure
typedef struct
{
  int checkSum;
  int ver;
  int companyId;
  int deviceId;
  int command;
  int ackNack;
  int data[MAX_DATA];
} cmdResponse;


// declare the instances of response command
cmdResponse cmdRes;
cmdCommand  cmdCmd;



// declare variables to store sensor data
int moistureValue     = 0;
int humidityValue     = 0;
int temperatureValue  = 0;
int lightValue        = 0;


// declare sensor PINS
int pumpPin              = 3;
int sensorMoisturePin    = 4;
int sensorHumidityPin    = 5;
int sensorTemperaturePin = 6;
int sensorLightPin       = 7;


void setup() {
  // start serial port at 9600 baud
  Serial.begin(9600);
  Serial.setTimeout(1000);

  if (DEBUG){

    EEPROM.write(DEVICE_ID_INDEX, 0);
    EEPROM.write(COMPANY_ID_INDEX, 123);
    EEPROM.write(SENSOR_CONFIG ,31);
  }

  pinMode(pumpPin, OUTPUT); // defaults HIGH (relays off)
  digitalWrite(pumpPin,LOW);
}

// used to verify checksum of either commands or responses
int verifyChecksum(byte index) {
  int tmpSum = 0;

  if (DEBUG){
    Serial.println("verifying checksum");
    Serial.println(index);
  }

  // make sure commands have a minimum length
  if (index < MIN_CMD_LENGTH)
    return false;

  // start calculating checksums
  tmpSum  = cmdCmd.ver;
  tmpSum += cmdCmd.companyId;
  tmpSum += cmdCmd.deviceId;
  tmpSum += cmdCmd.command;

  if (DEBUG) {
    Serial.println(tmpSum);
  }


  // if command is longer than minimum, move items into data array
  if (index > 5) {
    for (int i = 0; i < (index - 5); i++) {
      tmpSum += cmdCmd.data[i];
    }
  }

  // return true if checksums match
  if (tmpSum == cmdCmd.checkSum) {
    return true;
  }

  //if you get here checksums didn't match so return false
  if (DEBUG){
      Serial.print("Checksum error");
      Serial.print(cmdCmd.checkSum);
      Serial.print(" != ");
      Serial.println(tmpSum);
  }
return false;
}


//used to calculate checksum of responses in the case of Arudino
int calculateCheckSum(byte index, int cmdOrRes) {
  int tmpSum =0;

  if (index < MIN_CMD_LENGTH)
    return false;

  // are we calculating command or response?
  if (cmdOrRes == CMD)
  {
    // start adding them up for a command struct...
    tmpSum  = cmdCmd.ver;
    tmpSum += cmdCmd.companyId;
    tmpSum += cmdCmd.deviceId;
    tmpSum += cmdCmd.command;

    // additional bytes go into data array of the command structure
    if (index > 5) {
      for (int i = 0; i < (index - 5); i++)
      {
        tmpSum += cmdCmd.data[i];
      }
    }
  }
  else
  {
    // it's a response struct...
    tmpSum  = cmdRes.ver;
    tmpSum += cmdRes.companyId;
    tmpSum += cmdRes.deviceId;
    tmpSum += cmdRes.command;
    tmpSum += cmdRes.ackNack;

    // copy over data bytes
    if (index > 5) {
      for (int i = 0; i < (index - 5); i++) {
        tmpSum += cmdRes.data[i];
      }
    }
  }
  //return the calculated tmpSum
  return tmpSum;
}

void loop() {

  // if characters have started coming in start processing them in getCommand()
  // it returns the incoming command
  if (Serial.available()) {
    switch (getCommand())
    {
      // report all sensor data, return ACK if successfully parsed
      // else return NACK
      case RPT_SENSORS:
        if (verifyChecksum(5)) {
          rptSensors(ACK);
        }
        else
          rptSensors(NACK);
        break;
      // NO LONGER PROCESSED 
      case RPT_SENSOR:
        if (verifyChecksum(5)) {
          rptSensor(ACK);
        }
        else
          rptSensor(NACK);
        break;
      // ocmmand to turn PUMP on/off
      case SET_SENSOR:
        if (verifyChecksum(6)) {
          setSensor(ACK);
        }
        else
          setSensor(NACK);
        break;
      // sets device ID
      case SET_DEVICE_ID:
        if (verifyChecksum(6)) {
          setDeviceId(ACK);
        }
        else
          setDeviceId(NACK);
        break;
      // report system status/config
      case RPT_SYSTEM_STATUS:
        if (verifyChecksum(5)) {
          rptSystemStatus(ACK);
        }
        else
          rptSystemStatus(NACK);
        break;

      default:
        // command error so flush serial buffer and start over
        //cmdError();
        //Serial.flush();
        break;
    }
  }
}


// read/collect all sensor data
byte rptSensors(int ackNack) {

  // used to keep track of sensor data
  int index = 0;
  int dataIndex = 0;
  int sensorConfig = EEPROM.read(SENSOR_CONFIG);


  // setup response
  cmdRes.ver = cmdCmd.ver;
  index++;
  cmdRes.command = cmdCmd.command;
  index++;
  cmdRes.deviceId = EEPROM.read(DEVICE_ID_INDEX);
  index++;
  cmdRes.companyId =   EEPROM.read(COMPANY_ID_INDEX);
  index++;
  cmdRes.ackNack = ackNack;
  index++;

  // see if command is an ACK or NACK
  if (ackNack == NACK)
  {
    cmdRes.data[0] = CHECKSUM_ERR;
    index++;
    cmdRes.checkSum = calculateCheckSum(index, RESP);
    sendResponse(index);
    return false;
  }
  // start filling in data[] with sensor data
  cmdRes.data[dataIndex] = sensorConfig;
  index++;


  // check in sensor bit if we need to report value
  for (int i = 0; i < 8; i++)
  {
    // bit shift through sensor configuration
    if (sensorConfig && (1 << i))
    {
      switch (1 << i)
      {
        // pump status (on/off)
        case 1:
          dataIndex++;
          index++;
          cmdRes.data[dataIndex] = pumpStatus;
          break;
          
        // moisture sensor
        case 2:
          dataIndex++;
          index++;
          cmdRes.data[dataIndex] = analogRead(sensorMoisturePin);
          break;
          
         //humidity sensor 
        case 4:
          dataIndex++;  
          index++;    
          cmdRes.data[dataIndex] = analogRead(sensorHumidityPin);
          break;
          
         // temperature sensor 
        case 8:
          dataIndex++; 
          index++;    
          cmdRes.data[dataIndex] = analogRead(sensorTemperaturePin);
          break;

        // light sensor
        case 16:
          dataIndex++;
          index++;
          cmdRes.data[dataIndex] = analogRead(sensorLightPin);
          break;
        default:
          break;
      }
    }
  }

  // last but no least chalculate checksum
  cmdRes.checkSum = calculateCheckSum(index, RESP);
  index++;
  sendResponse(index);
  return true;
}


int cmdError(){
  
 int index = 0;
  
  // setup response
  cmdRes.ver = cmdCmd.ver;
  index++;
  cmdRes.command = cmdCmd.command;
  index++;
  cmdRes.deviceId = EEPROM.read(DEVICE_ID_INDEX);
  index++;
  cmdRes.companyId =   EEPROM.read(COMPANY_ID_INDEX);
  index++;
  cmdRes.ackNack = NACK;
  index++;

 // error so turn off pump regardless
 
  digitalWrite(pumpPin, LOW);
  pumpStatus = LOW;
  cmdRes.data[0] = CMD_ERROR;
  index++;
  cmdRes.checkSum = calculateCheckSum(index, RESP);
  index++;
  sendResponse(index);
 
}

// NOT implemented
int rptSensor(int ackNack) {
  int status = 0;
  return status;
}

// used ot turn pump on/off
int setSensor(int ackNack) {

  int index = 0;
  
  // setup response
  cmdRes.ver = cmdCmd.ver;
  index++;
  cmdRes.command = cmdCmd.command;
  index++;
  cmdRes.deviceId = EEPROM.read(DEVICE_ID_INDEX);
  index++;
  cmdRes.companyId =   EEPROM.read(COMPANY_ID_INDEX);
  index++;
  cmdRes.ackNack = ackNack;
  index++;
  if(DEBUG){
    Serial.println("calling setSensor");
  }

  // is it an ack or nack response?
  if (ackNack == NACK)
  {
    // error so turn off pump regardless
    digitalWrite(pumpPin, LOW);
    pumpStatus = LOW;
    cmdRes.data[0] = CHECKSUM_ERR;
    index++;
    cmdRes.checkSum = calculateCheckSum(index, RESP);
    sendResponse(index);
  }
  else
  {
    pumpStatus = cmdCmd.data[0];
    digitalWrite(pumpPin, pumpStatus);
    cmdRes.data[0] = cmdCmd.data[0];
    index++;
    cmdRes.checkSum = calculateCheckSum(index, RESP);
    index++;
    sendResponse(index);
  }
  return true;
}

// set device id command
int setDeviceId(int ackNack) {

int index = 0;

  if (ackNack == ACK)
  {
    EEPROM.write(DEVICE_ID_INDEX, cmdCmd.data[0]);
    cmdRes.deviceId = cmdCmd.data[0];
  }
  else
    cmdRes.deviceId = EEPROM.read(DEVICE_ID_INDEX);

 index++;

  // copy over the info contained in the command struct to cmdRes
  cmdRes.companyId = cmdCmd.companyId;
  index++;
  cmdRes.ver = cmdCmd.ver;
  index++;
  cmdRes.command = cmdCmd.command;
  index++;
  cmdRes.ackNack = ackNack;
  index++;
  cmdRes.checkSum = calculateCheckSum(index, RESP);
  // send command response 
  index++;
  sendResponse(index);
}

void sendResponse(int index) {
  String strResp = "<";
  // create the response
  strResp += String(cmdRes.checkSum) + "~";
  strResp += String(cmdRes.ver) + "~";
  strResp += String(cmdRes.companyId) + "~";
  strResp += String(cmdRes.deviceId) + "~";
  strResp += String(cmdRes.command) + "~";
  strResp += String(cmdRes.ackNack) + "~";

  // fill in data[] if extra bites
  for (int i = 0; i < (index - 6); i++)
  {
    strResp +=  String(cmdRes.data[i]) + "~";
  }
  // terminate the response
  strResp += ">";

  // send out serial port
  Serial.write(strResp.c_str());
}


// report all sensor data. passed in an ACK or NACK
int rptSystemStatus(int ackNack) {

// index gets incremented for each varilable that needs to be sent out
int index = 0;

  // string to hold response
  String strResp;

  // fill in Response header information
  cmdRes.ver = VERSION;
  index++;
  cmdRes.companyId = EEPROM.read(COMPANY_ID_INDEX);
  index++;
  cmdRes.deviceId = EEPROM.read(DEVICE_ID_INDEX);
  index++;
  cmdRes.ackNack  = ackNack;
  index++;

  // calculate checksum depending on ack/nack
  if (ackNack == NACK)
    cmdRes.data[0] = CHECKSUM_ERR;
  else
    cmdRes.data[0] = EEPROM.read(SENSOR_CONFIG);

  index++;
  
  cmdRes.command = cmdCmd.command;
  index++;
  
  cmdRes.checkSum = calculateCheckSum(index, RESP);
  index++;
  
  // send response
  sendResponse(index);
}

// parse out the incoming command

int getCommand() {

  // Calculate based on max input size expected for one command
  // Get next command from Serial (add 1 for final 0)
  
  char serialBuffer[MAX_SIZE + 1];;
  char *charPtr = NULL;
  int intParams[10];
  byte index = 0;
  byte size;

  
  //read the command into serialBuffer[];
  // <1~2~3~4~5~> get rid of both < and >
  
  Serial.readBytesUntil('<', serialBuffer, MAX_SIZE);
  size = Serial.readBytesUntil('>', serialBuffer, MAX_SIZE);

  // terminate string with 0 to end the C string
  serialBuffer[size] = 0;

  // look for '~' and replace with 0
  charPtr = strtok(serialBuffer, "~");
  
  while (charPtr != 0)
  {
    // save pointer to first variable
    intParams[index] = atoi(charPtr);
    index++;
    *charPtr = 0;
    // point to next variable
    charPtr = strtok(0, "~");
  }
  
  // something went seriously wrong
  if (index == 0) {
    return CMD_ERROR;
  }

  // if this command is not for this device return and listen for more commands
  if ((EEPROM.read(DEVICE_ID_INDEX) != intParams[3]) && (intParams[3] != 255)) {
    return false;
  }

  // check that company id is correct
  // if this command is not for this device return and listen for more commands
  if (EEPROM.read(COMPANY_ID_INDEX) != intParams[2]) {
    return false;
  }

  // convert each input param to command struct
  for (int i = 0; i < index; i++)
  {

    switch (i)
    {
      case 0:
        cmdCmd.checkSum = intParams[i];
        break;

      case 1:
        cmdCmd.ver = intParams[i];
        break;

      case 2:
        cmdCmd.companyId = intParams[i];
        break;

      case 3:
        cmdCmd.deviceId = intParams[i];
        break;

      case 4:
        cmdCmd.command = intParams[i];
        break;

      case 5:
        cmdCmd.data[0] = intParams[i];
        break;

      case 6:
        cmdCmd.data[1] = intParams[i];
        break;

      default:
        //return CMD_ERROR;
        break;
    }
  }
  return cmdCmd.command;
}
