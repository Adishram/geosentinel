import { useEffect, useRef } from "react";
import * as THREE from "three";

/** Art-directed procedural sculpture. Deliberately not an elevation dataset. */
export default function Terrain() {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = container.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.setClearColor(0x080c0b, 0);
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x080c0b, 0.035);
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(15, 14, 18);
    camera.lookAt(0, 0, 0);
    const terrain = new THREE.Group();
    terrain.rotation.y = -0.4;
    scene.add(terrain);
    const height = (x: number, z: number) =>
      3.3 * Math.exp(-((x + 2.8) ** 2 / 9 + (z + 0.7) ** 2 / 7)) +
      2.5 * Math.exp(-((x - 2) ** 2 / 5 + (z + 2) ** 2 / 9)) +
      1.9 * Math.exp(-((x - 3.5) ** 2 / 7 + (z - 2.4) ** 2 / 4)) +
      0.17 * Math.sin(x * 2 + z) * Math.cos(z * 1.6);
    const geometry = new THREE.PlaneGeometry(17, 12, 130, 90);
    geometry.rotateX(-Math.PI / 2);
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++)
      positions.setY(i, height(positions.getX(i), positions.getZ(i)));
    geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({
      color: 0x173a2d,
      roughness: 0.8,
      metalness: 0.25,
      side: THREE.DoubleSide,
    });
    terrain.add(new THREE.Mesh(geometry, material));
    const lines: THREE.BufferGeometry[] = [];
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x6daa89,
      transparent: true,
      opacity: 0.34,
    });
    for (let z = -6; z < 6; z += 0.16) {
      const points = [];
      for (let x = -8.5; x <= 8.5; x += 0.09)
        points.push(new THREE.Vector3(x, height(x, z) + 0.017, z));
      const line = new THREE.BufferGeometry().setFromPoints(points);
      lines.push(line);
      terrain.add(new THREE.Line(line, lineMaterial));
    }
    // A single study-ring motif over the abstract landscape, not a geographic geofence.
    const ringPoints = [];
    for (let t = 0; t <= Math.PI * 2 + 0.02; t += 0.02) {
      const x = 3.5 * Math.cos(t) + 0.5,
        z = 3.5 * Math.sin(t);
      ringPoints.push(new THREE.Vector3(x, height(x, z) + 0.055, z));
    }
    const ringGeometry = new THREE.BufferGeometry().setFromPoints(ringPoints);
    const ringMaterial = new THREE.LineBasicMaterial({
      color: 0x9deac5,
      transparent: true,
      opacity: 0.85,
    });
    terrain.add(new THREE.Line(ringGeometry, ringMaterial));
    scene.add(new THREE.AmbientLight(0xa4c9bc, 1.8));
    const light = new THREE.DirectionalLight(0xc9ffdb, 3.2);
    light.position.set(-4, 8, 3);
    scene.add(light);
    const warm = new THREE.DirectionalLight(0xdab47b, 0.9);
    warm.position.set(4, 3, -5);
    scene.add(warm);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0,
      visible = true;
    const render = () => {
      frame = 0;
      if (visible) renderer.render(scene, camera);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(render);
    };
    const resize = new ResizeObserver(() => {
      const { width, height } = host.getBoundingClientRect();
      renderer.setSize(width, height);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
      schedule();
    });
    resize.observe(host);
    const scroll = () => {
      if (reduced.matches) return;
      const progress = Math.min(scrollY / innerHeight, 1);
      terrain.rotation.y = -0.4 + progress * 0.28;
      camera.position.y = 14 - progress * 2;
      camera.lookAt(0, 0, 0);
      schedule();
    };
    const observer = new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      if (visible) schedule();
    });
    observer.observe(host);
    addEventListener("scroll", scroll, { passive: true });
    return () => {
      removeEventListener("scroll", scroll);
      resize.disconnect();
      observer.disconnect();
      cancelAnimationFrame(frame);
      geometry.dispose();
      material.dispose();
      lineMaterial.dispose();
      ringGeometry.dispose();
      ringMaterial.dispose();
      lines.forEach((line) => line.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);
  return <div className="terrain-canvas" ref={container} aria-hidden="true" />;
}
