/* Configuração global do Three.js — deve ser o primeiro módulo do motor a carregar.
   Desligamos o gerenciamento de cor para que as texturas procedurais e os shaders
   apareçam exatamente com as cores definidas no código (sem conversão sRGB). */
import * as THREE from 'three';

THREE.ColorManagement.enabled = false;
