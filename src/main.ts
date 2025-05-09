import './style.css'
import * as THREE from 'three';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

let camera: THREE.PerspectiveCamera, scene: THREE.Scene, renderer: THREE.WebGLRenderer, mixer: THREE.AnimationMixer;
const reycaster = new THREE.Raycaster();
let model: THREE.Object3D;
let pyramid: THREE.Mesh;
let modelBox = new THREE.Box3();
let pyramidBox = new THREE.Box3();
let modelBoxHelper: THREE.BoxHelper;
let pyramidBoxHelper: THREE.BoxHelper;

const uniforms = {
  time: { value: 0.0 },
  resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
  testColor: { value: new THREE.Color(0xff0000) },
  faceVertexUvs: { value: new Float32Array([1, 0, 0, 1]) }
};

init();

function init() {

  const container = document.createElement( 'div' );
  document.body.appendChild( container );

  camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
  camera.position.set( - 1.8, 0.6, 2.7 );
  camera.fov = 120;
  camera.updateProjectionMatrix();

  scene = new THREE.Scene();

  new RGBELoader()
    .setPath( 'textures/equirectangular/' )
    .load( 'korea.hdr', function ( texture ) {

      texture.mapping = THREE.EquirectangularReflectionMapping;

      scene.background = texture;
      scene.environment = texture;

      render();

      const loader = new GLTFLoader().setPath( 'models/gltf/DamagedHelmet/glTF/' );
      loader.load( 'poulpechrome.gltf', async function ( gltf ) {

        model = gltf.scene;


        await renderer.compileAsync( model, camera, scene );

        mixer = new THREE.AnimationMixer(model);
        gltf.animations.forEach((clip) => {
            mixer.clipAction(clip).play();
        }, (event: ErrorEvent) => {console.log("erreur"+event)});

        scene.add( model ); 

        modelBoxHelper = new THREE.BoxHelper(model, 0x00ff00);
        scene.add(modelBoxHelper);

        const vertexShader = `
        varying vec2 vUv;
      
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
        `;
        
        const fragmentShader = `
          uniform float time;
          uniform vec3 testColor;
          varying vec2 vUv;
        
          void main() {
            vec3 color = testColor * abs(sin(time + vUv.x * 3.14159));
            gl_FragColor = vec4(color, 1.0);
          }
        `;
        
        const material = new THREE.ShaderMaterial({
          uniforms: {
            time: uniforms.time,
            testColor: uniforms.testColor,
          },
          vertexShader: vertexShader,
          fragmentShader: fragmentShader,
          side: THREE.DoubleSide,
        });
        
        function createPyramid(baseWidth: number, height: number, color: number) {
          let vertices: number[] = [];
          for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            const x = Math.cos(angle) * baseWidth / 2;
            const y = Math.sin(angle) * baseWidth / 2;
            vertices.push(x, y, 0);
          }
          vertices.push(0, 0, height); 
          const indices: number[] = [];
          for (let i = 0; i < 4; i++) {
            indices.push(i, (i + 1) % 4, 4);
          }
          indices.push(0, 1, 2, 0, 2, 3)
          console.log(indices);

          const geometry = new THREE.BufferGeometry();
          geometry.setIndex(indices);
          geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
          geometry.computeVertexNormals();
          pyramid = new THREE.Mesh(geometry, material);
          pyramid.position.set(5, 0, 0);
          pyramid.rotation.set(Math.PI / -2, 0, 0);
          pyramid.geometry.computeBoundingBox();
          pyramidBox.setFromObject(pyramid);
          scene.add(pyramid);

          pyramidBoxHelper = new THREE.BoxHelper(pyramid, 0xff0000);
          scene.add(pyramidBoxHelper);
          
        }

        let pyramidDirection = new THREE.Vector3(-0.05, 0, 0); 

        function animate() {
          requestAnimationFrame(animate);
          uniforms.time.value += 0.01;

          if (pyramid) {
            pyramid.position.add(pyramidDirection);
            pyramidBox.setFromObject(pyramid);
            pyramidBoxHelper.update();
        
            if (model && modelBox.intersectsBox(pyramidBox)) {
              console.log("Collision détectée !");
              pyramidDirection.negate();
              console.log(pyramid.position.x, pyramid.position.y, pyramid.position.z);
            }
            if (pyramid.position.x > 5) {
              pyramidDirection.negate();
            }
          }
        
          if (model) {
            modelBox.setFromObject(model);
            modelBoxHelper.update(); 
          }

          mixer.update(1 / 50);
          render();
        }
       
        animate();
        createPyramid(2, 1, 0x808080);

        render();

      } );

    } );

  renderer = new THREE.WebGLRenderer( { antialias: true } );
  renderer.setPixelRatio( window.devicePixelRatio );
  renderer.setSize( window.innerWidth, window.innerHeight );
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  container.appendChild( renderer.domElement );

  const controls = new OrbitControls( camera, renderer.domElement );
  controls.addEventListener( 'change', render ); 
  controls.minDistance = 2;
  controls.maxDistance = 10;
  controls.target.set( 0, 0, - 0.2 );
  controls.update();

  window.addEventListener( 'resize', onWindowResize );
  window.addEventListener( 'click', setPickPosition );
}

function onWindowResize() {

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize( window.innerWidth, window.innerHeight );

  render();

}

function setPickPosition(event: MouseEvent) {
  let pos: THREE.Vector2 = new THREE.Vector2(0,0);
  pos.x = ( event.clientX / window.innerWidth ) * 2 - 1;
  pos.y = - ( event.clientY / window.innerHeight ) * 2 + 1;

  reycaster.setFromCamera( pos, camera );
  const intersectedObjects = reycaster.intersectObjects(scene.children);

  if (intersectedObjects.length > 0) {
    const intersection = intersectedObjects[0]
    if (intersection.object instanceof THREE.Mesh) {
      const material = intersection.object.material as THREE.MeshStandardMaterial;
      if (material) {
        material.color.set(Math.random() * 0xffffff);
      }
    }
  }
  render();
}

function render() {

  renderer.render( scene, camera );

}