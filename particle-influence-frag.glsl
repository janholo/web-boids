#version 300 es
precision mediump float;


in vec2 v_TexCoord;
in vec2 v_Velocity;

out vec4 o_FragColor;

void main() {
  float scaleDownFactor = 0.25;

  vec2 norm = (v_TexCoord - 0.5) * 2.0; // -1.0 ... 1.0
  float l = length(norm);
  if(l < 0.1)
  {
    l = 1.0;
  }

  // separation force
  float separationAmplitude = max(1.0 - 2.0 * l, 0.0);
  vec2 separationForce = normalize(norm) * separationAmplitude * scaleDownFactor;

  float alignmentAmplitude = max(1.0 - l, 0.0);
  vec2 alignmentForce = v_Velocity * alignmentAmplitude * scaleDownFactor;

  o_FragColor = vec4(separationForce, alignmentForce);
}
