1. Calling the API
#
Install the client
#

The client provides a convenient way to interact with the model API.

npm install --save @fal-ai/serverless-client

Setup your API Key
#

Set FAL_KEY as an environment variable in your runtime.

export FAL_KEY="YOUR_API_KEY"

Submit a request
#

The client API handles the API submit protocol. It will handle the request status updates and return the result when the request is completed.

import * as fal from "@fal-ai/serverless-client";

const result = await fal.subscribe("fal-ai/flux-pro", {
  input: {
    prompt: "Extreme close-up of a single tiger eye, direct frontal view. Detailed iris and pupil. Sharp focus on eye texture and color. Natural lighting to capture authentic eye shine and depth. The word \"FLUX\" is painted over it in big, white brush strokes with visible texture."
  },
  logs: true,
  onQueueUpdate: (update) => {
    if (update.status === "IN_PROGRESS") {
      update.logs.map((log) => log.message).forEach(console.log);
    }
  },
});

2. Authentication
#

The API uses an API Key for authentication. It is recommended you set the FAL_KEY environment variable in your runtime when possible.
API Key
#
In case your app is running in an environment where you cannot set environment variables, you can set the API Key manually as a client configuration.

import * as fal from "@fal-ai/serverless-client";

fal.config({
  credentials: "YOUR_FAL_KEY"
});

Protect your API Key

When running code on the client-side (e.g. in a browser, mobile app or GUI applications), make sure to not expose your FAL_KEY. Instead, use a server-side proxy to make requests to the API. For more information, check out our server-side integration guide.
3. Files
#

Some attributes in the API accept file URLs as input. Whenever that's the case you can pass your own URL or a Base64 data URI.
Data URI (base64)
#

You can pass a Base64 data URI as a file input. The API will handle the file decoding for you. Keep in mind that for large files, this alternative although convenient can impact the request performance.
Hosted files (URL)
#

You can also pass your own URLs as long as they are publicly accessible. Be aware that some hosts might block cross-site requests, rate-limit, or consider the request as a bot.
Uploading files
#

We provide a convenient file storage that allows you to upload files and use them in your requests. You can upload files using the client API and use the returned URL in your requests.

import * as fal from "@fal-ai/serverless-client";

// Upload a file (you can get a file reference from an input element or a drag-and-drop event)
const file = new File(["Hello, World!"], "hello.txt", { type: "text/plain" });
const url = await fal.storage.upload(file);

// Use the URL in your request
const result = await fal.subscribe("fal-ai/flux-pro", { image_url: url });

Auto uploads

The client will auto-upload the file for you if you pass a binary object (e.g. File, Data).

Read more about file handling in our file upload guide.
4. Schema
#
Input
#
prompt*string

The prompt to generate an image from.
image_sizeImageSize | Enum

The size of the generated image. Default value: landscape_4_3

Possible values: "square_hd", "square", "portrait_4_3", "portrait_16_9", "landscape_4_3", "landscape_16_9"
num_inference_stepsinteger

The number of inference steps to perform. Default value: 28
seedinteger

The same seed and the same prompt given to the same version of the model will output the same image every time.
guidance_scalefloat

The CFG (Classifier Free Guidance) scale is a measure of how close you want the model to stick to your prompt when looking for a related image to show you. Default value: 3.5
sync_modeboolean

If set to true, the function will wait for the image to be generated and uploaded before returning the response. This will increase the latency of the function but it allows you to get the image directly in the response without going through the CDN.
num_imagesinteger

The number of images to generate. Default value: 1
safety_toleranceSafetyToleranceEnum

The safety tolerance level for the generated image. 1 being the most strict and 5 being the most permissive. Default value: "2"

Possible values: "1", "2", "3", "4", "5", "6"

{
  "prompt": "Extreme close-up of a single tiger eye, direct frontal view. Detailed iris and pupil. Sharp focus on eye texture and color. Natural lighting to capture authentic eye shine and depth. The word \"FLUX\" is painted over it in big, white brush strokes with visible texture.",
  "image_size": "landscape_4_3",
  "num_inference_steps": 28,
  "guidance_scale": 3.5,
  "num_images": 1,
  "safety_tolerance": "2"
}

Output
#
images*list<Image>

The generated image files info.
timings*Timings
seed*integer

Seed of the generated Image. It will be the same value of the one passed in the input or the randomly generated that was used in case none was passed.
has_nsfw_concepts*list<boolean>

Whether the generated images contain NSFW concepts.
prompt*string

The prompt used for generating the image.

{
  "images": [
    {
      "url": "",
      "content_type": "image/jpeg"
    }
  ],
  "prompt": ""
}