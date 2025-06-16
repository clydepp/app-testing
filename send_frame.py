# FPGA side - corrected code
import PIL.Image
import numpy as np
import asyncio
import websockets 

frame = imgen_vdma.readframe()

async def send_frame(frame):
    try:
        async with websockets.connect("ws://192.168.137.1:8002") as websocket:
            frame_bytes = frame.tobytes()
            await websocket.send(frame_bytes)
            print("sent frame?")
    except Exception as e:
        print(e)

await send_frame(frame) 