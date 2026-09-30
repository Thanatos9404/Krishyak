const mockPost=jest.fn();
jest.mock('axios',()=>({create:()=>({post:mockPost})}));
const {farmingApi}=require('./farmingApi');

afterEach(()=>jest.restoreAllMocks());

test('registration failures do not log or return submitted personal details', async()=>{
  const log=jest.spyOn(console,'error').mockImplementation(()=>{});
  const privateProfile={fullName:'Private Test Farmer',mobileNumber:'private-test-number'};
  mockPost.mockRejectedValue({message:'private-test-number',config:{data:privateProfile}});
  expect(await farmingApi.registerFarmer(privateProfile)).toEqual({success:false,error:'common.error'});
  expect(log).not.toHaveBeenCalled();
  expect(mockPost).toHaveBeenCalledWith('/register-farmer',privateProfile,{timeout:30000});
});
