import debugpy
import time

debugpy.listen(5679)
while (1):
    time.sleep(1)
    print("Waiting")
