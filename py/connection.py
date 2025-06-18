from fastapi import FastAPI, WebSocket
from pydantic import BaseModel, validator
from qformatpy import qformat
import json
from pynq import Overlay
from pynq.lib.video import *

import PIL.Image
from io import BytesIO
import base64

class Update(BaseModel):
  re_c: float
  im_c: float  
  zoom: int
  max_iter: int
  colour_sch: str
    
  @validator('re_c', 'im_c')
  def convert_to_q4_28(cls, v):
    return qformat(v, 4, 28) 
  
overlay = Overlay("/home/xilinx/32_bit_zoom_2.bit")
imgen_vdma = overlay.video.axi_vdma_0.readchannel
pixgen = overlay.pixel_generator_0

videoMode = common.VideoMode(640, 480, 24)
imgen_vdma.mode = videoMode
imgen_vdma.start()

def generate_frame_with_params(update: Update):
  pixgen.register_map.gp0 = update.max_iter       
  pixgen.register_map.gp1 = update.zoom            
  pixgen.register_map.gp2 = update.re_c   
  pixgen.register_map.gp3 = update.im_c

  frame = imgen_vdma.readframe()
  image = PIL.Image.fromarray(frame)
  im_file = BytesIO()
  image.save(im_file, format='PNG')

  im_b64_string = base64.b64encode(im_file.getvalue()).decode('utf-8')
  return (f"data:image/png;base64,{im_b64_string}")

app = FastAPI()

updates = [Update(re_c=2.1234232, im_c=-1.324567, zoom=5, max_iter=200, colour_sch="classic")]

@app.get('/updates')
def get_updates() -> list[Update]: # this function specifies the return type
  return updates

@app.post('/updates')
def add_updates(update: Update):
  updates.append(update)
  return update

@app.websocket('/websocket')
async def websocket_endpoint(websocket: WebSocket):
  await websocket.accept()
  try:
    while True:
      data = await websocket.receive_text()
      params = json.loads(data)

      update = Update(
        re_c=params.get('center_x', -0.5),  
        im_c=params.get('center_y', 0.0),     
        zoom=int(params.get('zoom', 1)),      
        max_iter=params.get('max_iter', 1000),
        colour_sch=params.get('colour_sch', 'classic')
      )

      base_rep = generate_frame_with_params(update) # this comes from the notebook? or call frame/image
      await websocket.send_text(base_rep) # could be send_text though? - https://fastapi.tiangolo.com/reference/websockets/#fastapi.WebSocket.iter_json
      # add time buffer if necessary

  except:
    print("No valid connection made")
         
      