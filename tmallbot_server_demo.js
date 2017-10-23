//------------------------AbleCloud Methods Start------------------------
//-----------------------------------------------------------------------
/**
 * AbleCloud服务配置参数
 */
const ACConfig = {
    host: 'test.ablecloud.cn',  //服务地址
    port: 9005,                 //服务端口
    serviceVersion: 'v1',       //服务版本号
    majorDomainId: 1,           //主域id
    developerId: 1              //开发者id
};
/**
 * 发送指令至设备
 * @param subDomainId 设备子域id
 * @param deviceId 设备逻辑id
 * @param messageCode 消息码
 * @param payload 指令 binary: new Buffer([0xFF, 0x01, 0xAF, 0x02])  json(object): {key: 'value'}
 * @param accessToken 通过OAuth获取的用户token
 * @param callback 请求响应
 */
function sendToDevice(subDomainId, deviceId, messageCode, payload, accessToken, callback = (resp, error) => {}) {
    var method = 'sendToDevice?subDomain='+subDomainId+'&deviceId='+deviceId+'&messageCode='+messageCode;
    sendAbleCloudRequest('zc-bind', method, subDomainId, payload, accessToken, (respBuffer) => {
        parseResponse(respBuffer, callback);
    }, true); 
}
/**
 * 发送UDS请求
 * @param service 服务名称
 * @param method 方法名称即UDS中的name
 * @param subDomainId 服务子域id 注：若为主域服务则传入 "" 即可
 * @param service 服务名称
 * @param body 请求参数体
 * @param accessToken 通过OAuth获取的用户token
 * @param callback 请求响应
 */
function sendToService(service, method, subDomainId, body, accessToken, callback = (resp, error)=>{}) {
    sendAbleCloudRequest(service, method, subDomainId, body, accessToken, (respBuffer) => {
        parseResponse(respBuffer, callback);
    });
}

/**
 * internal method
 */
function parseResponse(respBuffer, callback) {
    try {
        var response = JSON.parse(respBuffer.toString());
        if (response.errorCode) {
            callback(null, response);
        } else {
            callback(response, null);
        }
        return;
    } catch (e) {}
    callback(respBuffer, null);
}
/**
 * internal method
 */
function sendAbleCloudRequest(service, method, subDomainId, body, accessToken, callback, isStream = false) {
    var https = require('https');  
    var options = {  
        hostname: ACConfig.host,  
        port: ACConfig.port,  
        path: '/' + [service, ACConfig.serviceVersion, method].join('/'),  
        method: 'POST',
        headers: {
            'Content-Type': isStream ? 'application/octet-stream' : 'application/x-zc-object',
            'X-Zc-Sub-Domain-Id': subDomainId ? subDomainId : "",
            'X-Zc-Major-Domain-Id': ACConfig.majorDomainId,
            'X-Zc-Developer-Id': ACConfig.developerId,
            'X-Zc-OAuth-Access-Token': accessToken ? accessToken : ""
        }
    };
    var req = https.request(options, function (res) {  
        if (res.statusCode != 200) {
            console.log(res.statusCode);
            return;
        }
        var chunks = [];
        var size = 0;
        res.on('data', function(chunk){
            chunks.push(new Buffer(chunk));
            size += chunk.length;
        });
        res.on('end', function(){
            callback(Buffer.concat(chunks, size));
        });
    });
    req.on('error', function (e) {
        console.log(e);
    });
    req.end(Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
//-----------------------------------------------------------------------
//------------------------AbleCloud Methods End--------------------------

//------------------------Server Example Start------------------------
//-- 智能家居协议请参考： http://doc-bot.tmall.com/docs/doc.htm?spm=0.0.0.0.5FrREj&treeId=393&articleId=107454&docType=1
var PORT = 3006
var url = require('url');
/**
 * 开启服务
 */
require('http').createServer((request, response) => {
    let method = url.parse(request.url).pathname.replace('/', '');
    if (method == 'test') { // 技能服务配置页面配置的网管地址
        let bodyBuff = [];
        request.on('data', (chunk) => {
            bodyBuff.push(chunk);
        }).on('end', () => {
            let body = JSON.parse(Buffer.concat(bodyBuff).toString());
            let userAccessToken = body.payload.accessToken; // 获取AC平台用户的token
            // 1.协议解析示例：设备发现 
            if (body.header.namespace == "AliGenie.Iot.Device.Discovery" &&
                body.header.name == "DiscoveryDevices") {
                /** 
                 * 将请求发至uds进行业务逻辑处理
                 * sendToService("serviceName", "serviceMethod", "subDomainId", {}, userAccessToken, (udsResp, error) => {
                 *     let respBody = {
                 *         header: Object.assign({}, body.header, {name: "DiscoveryDevicesResponse"}),
                 *         payload: { //此部分payload需要根据uds业务逻辑处理结果返回的 udsResp 来拼接
                 *         }
                 *     };
                 *     response.end(JSON.stringify(respBody)); 
                 * });
                 */
                let respBodyMock = { // 示例返回
                    header: Object.assign({}, body.header, {name: "DiscoveryDevicesResponse"}),
                    payload: buildMockDevicesPayload()
                };
                response.end(JSON.stringify(respBodyMock));
            }
            // 2.协议解析示例：设备控制打开（此部分也可放至UDS处理） 
            if (body.header.namespace == "AliGenie.Iot.Device.Control" &&
                body.header.name == "TurnOn") {
                /** 
                 * 直接发起控制指令
                 * sendToDevice("subDomainId", body.payload.deviceId, 68, new Buffer([0xFF, 0x01, 0xAF, 0x02]), userAccessToken, (resp, error) => {
                 *      //处理设备响应     
                 *     let respBody = {
                 *         header: Object.assign({}, body.header, {name: "TurnOnResponse"}),
                 *         payload: { deviceId: body.payload.deviceId }
                 *     };
                 *     response.end(JSON.stringify(respBody)); 
                 * })
                 */
                let respBodyMock = { // 示例返回
                    header: Object.assign({}, body.header, {name: "TurnOnResponse"}),
                    payload: { deviceId: body.payload.deviceId }
                };
                response.end(JSON.stringify(respBodyMock));
            }
        });
    }
}).listen(PORT);

/**
 * 测试获取设备 mock
 */
function buildMockDevicesPayload() {
    return {
      "devices":[{
      "deviceId":"4178",
      "deviceName":"light1",
      "deviceType":"light",
      "zone":"",          
      "brand":"",
      "model":"",     
      "icon":"https://www.ablecloud.cn/img/AClogo.png",
      "properties":[{
        "name":"color",
        "value":"red"
       }],
      "actions":[
        "TurnOn",
        "TurnOff"
     ],
      "extensions":{
         "extension1":"",
         "extension2":""
      }
     }]
   };
}
//--------------------------------------------------------------------
//------------------------Server Example End--------------------------
