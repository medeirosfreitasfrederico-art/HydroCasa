/* Limites aprovados; não altera dados de medição. */
(function(root){
const C=Object.freeze({
 activityRatio:1.20,dailyTolerancePercent:10,
 continuousMinutes:20,continuousConfirmations:3,minimumFlow:0.05,
 peakMultiplier:2.5,peakMinimumLpm:0.5,peakSamples:8,
 shareIncreasePoints:25,shareHistoryDays:7,
 trendRecentDays:3,trendPreviousDays:7,trendRatio:1.25,
 silentSensorMinutes:10,nightStart:0,nightEnd:5,
 repeatMinutes:60,staleSeconds:15,minimumHistoryDays:3
});
root.HydroAlertConfig=C;if(typeof module==='object'&&module.exports)module.exports=C;
})(typeof globalThis!=='undefined'?globalThis:this);
