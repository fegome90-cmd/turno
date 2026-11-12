import test from 'node:test';
import assert from 'node:assert/strict';
import * as sdk from '@strands-agents/sdk';
import {invocationSignal,attachLifecycleMetrics,sanitizeModelMetrics} from '../strands-runtime.mjs';

class OfflineModel extends sdk.Model {
  calls=0;
  getConfig(){return {modelId:'turno-offline-test'};}
  updateConfig(){}
  async *stream(){
    this.calls++;
    yield new sdk.ModelMessageStartEvent({role:'assistant'});
    yield new sdk.ModelContentBlockStartEvent({});
    yield new sdk.ModelContentBlockDeltaEvent({delta:{type:'textDelta',text:'synthetic response'}});
    yield new sdk.ModelContentBlockStopEvent({});
    yield new sdk.ModelMessageStopEvent({stopReason:'endTurn'});
    yield new sdk.ModelMetadataEvent({usage:{inputTokens:5,outputTokens:2,totalTokens:7}});
  }
}

test('pack SDK: actual Strands hooks count an offline model invocation',async()=>{
  const model=new OfflineModel(),records=[];
  const agent=new sdk.Agent({model,tools:[],printer:false});
  const observer=attachLifecycleMetrics(agent,sdk,r=>records.push(r));
  try {
    const result=await agent.invoke('synthetic input',{limits:{turns:1},cancelSignal:invocationSignal(undefined,2000)});
    observer.finish(result);observer.finish(result);
    assert.equal(result.stopReason,'endTurn');assert.equal(model.calls,1);assert.equal(records.length,1);
    assert.equal(records[0].modelCalls,1);assert.equal(records[0].modelErrors,0);
    assert.equal(records[0].inputTokens,5);assert.equal(records[0].outputTokens,2);
    assert.equal(records[0].stopReason,'endTurn');
    assert.equal(JSON.stringify(records).includes('synthetic'),false);
  }finally{await agent.shutdown();}
});

test('pack SDK: a cancelled invocation never reaches the offline model',async()=>{
  const c=new AbortController();c.abort();const model=new OfflineModel();
  const agent=new sdk.Agent({model,tools:[],printer:false});
  try {
    const result=await agent.invoke('synthetic',{cancelSignal:invocationSignal(c.signal,2000)});
    assert.equal(result.stopReason,'cancelled');assert.equal(model.calls,0);
  }finally{await agent.shutdown();}
});

test('pack SDK: metrics sink failure cannot alter a result',async()=>{
  const agent=new sdk.Agent({model:new OfflineModel(),tools:[],printer:false});
  const observer=attachLifecycleMetrics(agent,sdk,async()=>{throw new Error('ignored telemetry failure');});
  try {
    const result=await agent.invoke('synthetic');observer.finish(result);
    await new Promise(resolve=>setImmediate(resolve));assert.equal(result.stopReason,'endTurn');
  }finally{await agent.shutdown();}
});

test('pack metrics: only bounded counters and fixed codes leave the adapter',()=>{
  const value=sanitizeModelMetrics({modelCalls:-1,modelErrors:Infinity,inputTokens:4.1,outputTokens:9,
    durationMs:2,stopReason:'private note',note:'private note',password:'not a real credential'});
  assert.equal(value.modelCalls,null);assert.equal(value.modelErrors,null);assert.equal(value.inputTokens,null);
  assert.equal(value.outputTokens,9);assert.equal(value.stopReason,'unknown');
  assert.deepEqual(Object.keys(value).sort(),['durationMs','inputTokens','modelCalls','modelErrors','outputTokens','stopReason','turns'].sort());
});
