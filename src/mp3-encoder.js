import lamejs from "lamejs";

function floatTo16BitPCM(input) {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

export function encodeMp3(samples, sampleRate) {
  const encoder = new lamejs.Mp3Encoder(1, sampleRate, 128);
  const pcm16 = floatTo16BitPCM(samples);
  const blockSize = 1152;
  const mp3Data = [];

  for (let i = 0; i < pcm16.length; i += blockSize) {
    const chunk = pcm16.subarray(i, i + blockSize);
    const buf = encoder.encodeBuffer(chunk);
    if (buf.length > 0) mp3Data.push(buf);
  }
  const end = encoder.flush();
  if (end.length > 0) mp3Data.push(end);

  return new Blob(mp3Data, { type: "audio/mp3" });
}
