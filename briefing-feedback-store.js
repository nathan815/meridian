(function(root){
  'use strict';
  const hostName='com.meridian.briefing_feedback';
  function send(message){
    return new Promise(resolve=>{
      if(!root.chrome?.runtime?.sendNativeMessage){
        resolve({status:'unavailable'});
        return;
      }
      chrome.runtime.sendNativeMessage(hostName,message,response=>{
        if(chrome.runtime.lastError||!response){
          resolve({status:'unavailable'});
          return;
        }
        resolve(response);
      });
    });
  }
  function update(text){
    let feedback;
    try{feedback=JSON.parse(text);}
    catch{return Promise.resolve({status:'invalid'});}
    return send({type:'writeFeedback',feedback});
  }
  root.MeridianBriefingFeedbackStore=Object.freeze({update});
})(globalThis);
