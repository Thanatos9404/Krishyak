// Run fixed, checked-in provider scripts against analytic spectra, not satellite validation.
import fs from 'fs';
import path from 'path';
import vm from 'vm';
const directory=path.join(__dirname,'../../../backend/remote_sensing/evalscripts');
const script=name=>{
  const context=vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(directory,`${name}.js`),'utf8'),context);
  return context;
};
test.each([['ndvi','B08','B04'],['ndmi','B08','B11'],['ndre','B8A','B05']])('%s uses correct bands, masks and an analytic normalized difference', (index,a,b)=>{
  const stats=script(`${index}_statistics`), image=script(index);
  expect(stats.setup().input).toEqual([a,b,'SCL','dataMask']);
  expect(stats.setup().output[2].bands).toEqual(['index','footprint']);
  const sample={[a]:.8,[b]:.2,SCL:4,dataMask:1};
  const result=stats.evaluatePixel(sample);
  expect(result.index[0]).toBeCloseTo(.6);expect(result.dataMask).toEqual([1,1]);
  const color=image.evaluatePixel(sample);
  expect(color[0]).toBeCloseTo(.2);expect(color[1]).toBeCloseTo(.68);expect(color[2]).toBeCloseTo(.18);expect(color[3]).toBe(1);
  expect(stats.evaluatePixel({...sample,SCL:5}).dataMask).toEqual([1,1]);
  for(const scl of [0,1,2,3,6,7,8,9,10,11]) {
    expect(stats.evaluatePixel({...sample,SCL:scl}).dataMask).toEqual([0,1]);
    expect(image.evaluatePixel({...sample,SCL:scl})[3]).toBe(0);
  }
  expect(stats.evaluatePixel({...sample,dataMask:0}).dataMask).toEqual([0,0]);
});
test.each([['ndvi','B08','B04'],['ndmi','B08','B11'],['ndre','B8A','B05']])('%s masks zero denominators, negative and nonfinite reflectance', (index,a,b)=>{
  const stats=script(`${index}_statistics`),image=script(index);
  for(const values of [[0,0],[-.1,.2],[NaN,.2],[Infinity,.2],[undefined,.2]]) {
    const sample={[a]:values[0],[b]:values[1],SCL:4,dataMask:1};
    expect(stats.evaluatePixel(sample).dataMask).toEqual([0,1]);
    expect(image.evaluatePixel(sample)[3]).toBe(0);
  }
});
