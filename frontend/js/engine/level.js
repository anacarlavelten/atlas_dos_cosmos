/* Base comum dos três níveis de escala.

   Cada nível tem sua própria cena Three.js e uma lista de "picks": os astros que
   podem receber rótulo, hover, clique e voo da câmera. Um pick tem:
     id, name, kind, cat (categoria), col (cor opcional)
     getPos(out)  posição no mundo (Vector3)
     radius()     raio visível (para clique e distância mínima)
     view         distância da câmera ao voar até ele (número ou função)
     minD         distância mínima de aproximação
     prio         prioridade do rótulo quando há sobreposição
     virtual      não tem rótulo na cena (só aparece na lista)
     nofly        não tem posição: o clique só abre o card */
import * as THREE from 'three';

export class Level {
  constructor(id, name, max) {
    this.id = id;
    this.name = name;
    this.max = max;
    this.scene = new THREE.Scene();
    this.sky = null;
    this.picks = [];
  }

  add(o) {
    o.level = this.id;
    o.prio = o.prio ?? 50;
    o.radius = o.radius || (() => 0);
    this.picks.push(o);
    return o;
  }

  find(id) {
    return this.picks.find(p => p.id === id) || null;
  }

  update() {}
}

export const worldPos = node => out => node.getWorldPosition(out);
