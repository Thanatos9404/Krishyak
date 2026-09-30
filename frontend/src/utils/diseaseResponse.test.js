import {parseDiseaseResponse} from './diseaseResponse';
const diagnosis=()=>({status:'disease_detected',model_available:true,crop_detected:'rice',
  disease:{id:'rice_blast',name:'Rice Blast',severity:'high',confidence:0.88},
  treatment:{chemical:['Advice'],prevention:['Monitor nearby plants']}});

test('retains valid classifier fields and prevention advice',()=>{
  const result=parseDiseaseResponse(diagnosis(),'rice');
  expect(result.treatment).toMatchObject(diagnosis().treatment);
  expect(result.disease).toMatchObject({name:'Rice Blast',confidence:0.88,severity:null,severity_source:'not_measured'});
});
test('unmeasured severity does not invalidate a classifier diagnosis',()=>{
  const data=diagnosis();data.disease.severity=null;
  expect(parseDiseaseResponse(data,'rice')).not.toBeNull();
});
test.each([null,'0.95',-1,1.01,NaN,Infinity])('rejects invalid confidence %s',confidence=>{
  const data=diagnosis();data.disease.confidence=confidence;
  expect(parseDiseaseResponse(data,'rice')).toBeNull();
});
test.each([{name:{}},{id:null},{severity:'critical'}])('rejects malformed disease fields %j',changes=>{
  const data=diagnosis();Object.assign(data.disease,changes);
  expect(parseDiseaseResponse(data,'rice')).toBeNull();
});
test('rejects unavailable models and a diagnosis for another crop',()=>{
  expect(parseDiseaseResponse({...diagnosis(),model_available:false},'rice')).toBeNull();
  expect(parseDiseaseResponse(diagnosis(),'wheat')).toBeNull();
});
test('normalizes supported crop aliases',()=>{
  expect(parseDiseaseResponse({...diagnosis(),crop_detected:'maize'},'corn')).not.toBeNull();
});
test('discards malformed optional advice and server-supplied local details',()=>{
  const result=parseDiseaseResponse({...diagnosis(),treatment:{chemical:[{}],prevention:'spray'},diseaseDetails:{symptoms:[{}]}},'rice');
  expect(result.treatment.chemical).toBeUndefined();
  expect(result.treatment.prevention).toBeUndefined();
  expect(result.diseaseDetails).toBeUndefined();
});
test('healthy result requires probability and no conflicting disease',()=>{
  const healthy={status:'healthy',model_available:true,confidence:0.9,disease:null,crop_detected:'rice'};
  expect(parseDiseaseResponse(healthy,'rice')).toMatchObject(healthy);
  expect(parseDiseaseResponse({...healthy,confidence:null},'rice')).toBeNull();
  expect(parseDiseaseResponse({...healthy,disease:diagnosis().disease},'rice')).toBeNull();
  expect(parseDiseaseResponse({...healthy,crop_detected:'wheat'},'rice')).toBeNull();
  expect(parseDiseaseResponse({...healthy,crop_detected:undefined},'rice')).toBeNull();
  expect(parseDiseaseResponse({...healthy,crop_detected:'maize'},'corn')).not.toBeNull();
});
