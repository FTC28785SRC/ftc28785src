(function (root) {
  'use strict';
  const BBZ = root.BBZ = root.BBZ || {};
  const STORE = 'ftc-robot-cad';
  const MAX_BYTES = 30 * 1024 * 1024;
  const MAX_TRIANGLES = 15000;
  let active = null;
  let preparedKey = '', preparedFaces = [], preparedTop = [];

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!root.indexedDB) { reject(new Error('Trình duyệt này không hỗ trợ lưu mô hình CAD cục bộ.')); return; }
      const request = root.indexedDB.open(STORE, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('models');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Không mở được kho lưu mô hình CAD.'));
    });
  }
  function dbRequest(action, value) {
    return openDb().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction('models', 'readwrite');
      const request = action === 'put' ? tx.objectStore('models').put(value, 'robot')
        : action === 'delete' ? tx.objectStore('models').delete('robot')
          : tx.objectStore('models').get('robot');
      let result;
      request.onsuccess = () => { result = request.result; };
      request.onerror = () => reject(request.error || new Error('Không thể truy cập mô hình CAD đã lưu.'));
      tx.oncomplete = () => { db.close(); resolve(result); };
      tx.onerror = () => { db.close(); reject(tx.error || new Error('Không thể cập nhật kho mô hình CAD.')); };
      tx.onabort = () => { db.close(); reject(tx.error || new Error('Đã hủy thao tác lưu mô hình CAD.')); };
    }));
  }
  function finishMesh(triangles, name) {
    if (!triangles.length) throw new Error('File không có mặt tam giác 3D hợp lệ.');
    if (triangles.length > MAX_TRIANGLES) throw new Error('Mô hình có quá nhiều mặt. Hãy giảm xuống tối đa 15.000 mặt rồi tải lại.');
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    triangles.forEach((tri) => tri.forEach((p) => p.forEach((v, axis) => {
      lo[axis] = Math.min(lo[axis], v); hi[axis] = Math.max(hi[axis], v);
    })));
    const span = Math.max(hi[0] - lo[0], hi[1] - lo[1]);
    if (!Number.isFinite(span) || span < 1e-6 || hi[2] - lo[2] < 1e-6) throw new Error('Không xác định được kích thước 3D của mô hình.');
    const centerX = (lo[0] + hi[0]) / 2, centerY = (lo[1] + hi[1]) / 2;
    const faces = triangles.map((tri) => {
      const p = tri.map((v) => [(v[0] - centerX) / span, (v[1] - centerY) / span, (v[2] - lo[2]) / span]);
      const a = p[1], b = p[2], c = p[0];
      const ux = a[0] - c[0], uy = a[1] - c[1], uz = a[2] - c[2];
      const vx = b[0] - c[0], vy = b[1] - c[1], vz = b[2] - c[2];
      return { p, n: [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx], col: '#aeb8c2', a: 1, bias: 0, tag: 'cad' };
    });
    return { name, faces };
  }
  function parseObj(text, name) {
    const vertices = [], triangles = [];
    text.split(/\r?\n/).forEach((line) => {
      const s = line.trim().split(/\s+/);
      if (s[0] === 'v' && s.length >= 4) {
        const p = s.slice(1, 4).map(Number);
        if (p.every(Number.isFinite)) vertices.push(p);
      } else if (s[0] === 'f' && s.length >= 4) {
        const ids = s.slice(1).map((item) => {
          const n = parseInt(item.split('/')[0], 10);
          return n < 0 ? vertices.length + n : n - 1;
        });
        if (ids.some((i) => !Number.isInteger(i) || i < 0 || i >= vertices.length)) throw new Error('File OBJ có một mặt tham chiếu đỉnh không hợp lệ.');
        if (triangles.length + ids.length - 2 > MAX_TRIANGLES) throw new Error('Mô hình có quá nhiều mặt. Hãy giảm xuống tối đa 15.000 mặt rồi tải lại.');
        for (let i = 1; i < ids.length - 1; i++) triangles.push([vertices[ids[0]], vertices[ids[i]], vertices[ids[i + 1]]]);
      }
    });
    return finishMesh(triangles, name);
  }
  function parseStl(buffer, name) {
    const view = new DataView(buffer), triangles = [];
    const count = buffer.byteLength >= 84 ? view.getUint32(80, true) : 0;
    if (count > 0 && 84 + count * 50 <= buffer.byteLength) {
      if (count > MAX_TRIANGLES) throw new Error('Mô hình có quá nhiều mặt. Hãy giảm xuống tối đa 15.000 mặt rồi tải lại.');
      for (let i = 0; i < count; i++) {
        const start = 84 + i * 50 + 12, tri = [];
        for (let j = 0; j < 3; j++) tri.push([view.getFloat32(start + j * 12, true), view.getFloat32(start + j * 12 + 4, true), view.getFloat32(start + j * 12 + 8, true)]);
        if (tri.flat().every(Number.isFinite)) triangles.push(tri);
      }
    } else {
      const text = new TextDecoder().decode(buffer), verts = [];
      const re = /vertex\s+([-+.\deE]+)\s+([-+.\deE]+)\s+([-+.\deE]+)/gi;
      let m;
      while ((m = re.exec(text))) {
        const p = [Number(m[1]), Number(m[2]), Number(m[3])];
        if (p.every(Number.isFinite)) verts.push(p);
      }
      for (let i = 0; i + 2 < verts.length; i += 3) {
        if (triangles.length >= MAX_TRIANGLES) throw new Error('Mô hình có quá nhiều mặt. Hãy giảm xuống tối đa 15.000 mặt rồi tải lại.');
        triangles.push(verts.slice(i, i + 3));
      }
    }
    return finishMesh(triangles, name);
  }
  function multiply(a, b) {
    const out = new Array(16);
    for (let col = 0; col < 4; col++) for (let row = 0; row < 4; row++) {
      out[col * 4 + row] = a[row] * b[col * 4] + a[4 + row] * b[col * 4 + 1] + a[8 + row] * b[col * 4 + 2] + a[12 + row] * b[col * 4 + 3];
    }
    return out;
  }
  function nodeMatrix(node) {
    if (node.matrix && node.matrix.length === 16) return node.matrix;
    const t = node.translation || [0, 0, 0], s = node.scale || [1, 1, 1], q = node.rotation || [0, 0, 0, 1];
    const x = q[0], y = q[1], z = q[2], w = q[3];
    return [
      (1 - 2 * (y * y + z * z)) * s[0], (2 * (x * y + z * w)) * s[0], (2 * (x * z - y * w)) * s[0], 0,
      (2 * (x * y - z * w)) * s[1], (1 - 2 * (x * x + z * z)) * s[1], (2 * (y * z + x * w)) * s[1], 0,
      (2 * (x * z + y * w)) * s[2], (2 * (y * z - x * w)) * s[2], (1 - 2 * (x * x + y * y)) * s[2], 0,
      t[0], t[1], t[2], 1
    ];
  }
  function parseGlb(buffer, name) {
    const view = new DataView(buffer);
    if (buffer.byteLength < 20 || view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2) {
      throw new Error('File GLB không hợp lệ hoặc chưa dùng glTF 2.0.');
    }
    let offset = 12, json = null, binary = null;
    while (offset + 8 <= buffer.byteLength) {
      const length = view.getUint32(offset, true), type = view.getUint32(offset + 4, true);
      offset += 8;
      if (offset + length > buffer.byteLength) throw new Error('File GLB bị cắt hoặc hỏng.');
      if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, offset, length)));
      else if (type === 0x004e4942) binary = new Uint8Array(buffer, offset, length);
      offset += length;
    }
    if (!json || !binary || !json.meshes || !json.accessors || !json.bufferViews) throw new Error('GLB không có dữ liệu lưới 3D nhúng cần thiết.');
    const component = { 5121: [1, (v) => v.getUint8(0)], 5123: [2, (v) => v.getUint16(0, true)], 5125: [4, (v) => v.getUint32(0, true)], 5126: [4, (v) => v.getFloat32(0, true)] };
    function accessor(index) {
      const a = json.accessors[index], b = a && json.bufferViews[a.bufferView], info = a && component[a.componentType];
      if (!a || !b || !info || (b.buffer || 0) !== 0 || a.sparse) throw new Error('GLB dùng cấu trúc đỉnh chưa được hỗ trợ.');
      const parts = { SCALAR: 1, VEC3: 3 }[a.type];
      if (!parts) throw new Error('GLB có kiểu dữ liệu lưới chưa được hỗ trợ.');
      const stride = b.byteStride || info[0] * parts, start = (b.byteOffset || 0) + (a.byteOffset || 0), values = [];
      for (let i = 0; i < a.count; i++) {
        const tuple = [];
        for (let j = 0; j < parts; j++) tuple.push(info[1](new DataView(binary.buffer, binary.byteOffset + start + i * stride + j * info[0], info[0])));
        values.push(parts === 1 ? tuple[0] : tuple);
      }
      return values;
    }
    const triangles = [];
    function addMesh(meshIndex, matrix) {
      const mesh = json.meshes[meshIndex];
      (mesh.primitives || []).forEach((primitive) => {
        if ((primitive.mode === undefined ? 4 : primitive.mode) !== 4 || !primitive.attributes || primitive.attributes.POSITION === undefined) return;
        const positions = accessor(primitive.attributes.POSITION);
        const indices = primitive.indices === undefined ? positions.map((_, i) => i) : accessor(primitive.indices);
        for (let i = 0; i + 2 < indices.length; i += 3) {
          if (triangles.length >= MAX_TRIANGLES) throw new Error('Mô hình có quá nhiều mặt. Hãy giảm xuống tối đa 15.000 mặt rồi tải lại.');
          const tri = [indices[i], indices[i + 1], indices[i + 2]].map((index) => {
            const p = positions[index];
            if (!p) throw new Error('GLB có chỉ số đỉnh không hợp lệ.');
            const x = matrix[0] * p[0] + matrix[4] * p[1] + matrix[8] * p[2] + matrix[12];
            const y = matrix[1] * p[0] + matrix[5] * p[1] + matrix[9] * p[2] + matrix[13];
            const z = matrix[2] * p[0] + matrix[6] * p[1] + matrix[10] * p[2] + matrix[14];
            return [x, -z, y];
          });
          triangles.push(tri);
        }
      });
    }
    const nodes = json.nodes || [];
    function visit(index, parent, chain) {
      if (chain.has(index)) throw new Error('GLB có liên kết nút bị lặp.');
      const node = nodes[index];
      if (!node) throw new Error('GLB tham chiếu đến nút không hợp lệ.');
      const world = multiply(parent, nodeMatrix(node)), next = new Set(chain).add(index);
      if (node.mesh !== undefined) addMesh(node.mesh, world);
      (node.children || []).forEach((child) => visit(child, world, next));
    }
    if (nodes.length) {
      const scene = (json.scenes || [])[json.scene || 0], roots = scene ? scene.nodes : nodes.map((_, i) => i).filter((i) => !nodes.some((n) => (n.children || []).includes(i)));
      roots.forEach((index) => visit(index, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], new Set()));
    } else json.meshes.forEach((_, index) => addMesh(index, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]));
    return finishMesh(triangles, name);
  }
  async function read(file) {
    if (!file || file.size > MAX_BYTES) throw new Error('File CAD trống hoặc lớn hơn giới hạn 30 MB.');
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'obj' && ext !== 'stl' && ext !== 'glb') throw new Error('Định dạng chưa hỗ trợ. Hãy xuất mô hình thành GLB, OBJ hoặc STL rồi tải lại.');
    const mesh = ext === 'obj' ? parseObj(await file.text(), file.name)
      : ext === 'stl' ? parseStl(await file.arrayBuffer(), file.name)
        : parseGlb(await file.arrayBuffer(), file.name);
    return mesh;
  }
  function points(cfg, face) {
    const size = Math.max(cfg.length, cfg.width);
    const turn = cfg.cadFacing || 0;
    return face.p.map((p) => {
      const x = p[0], y = p[1];
      if (turn === 1) return [-y * size, x * size, p[2] * size];
      if (turn === 2) return [-x * size, -y * size, p[2] * size];
      if (turn === 3) return [y * size, -x * size, p[2] * size];
      return [x * size, y * size, p[2] * size];
    });
  }
  function normal(cfg, face) {
    const n = face.n, turn = cfg.cadFacing || 0;
    if (turn === 1) return [-n[1], n[0], n[2]];
    if (turn === 2) return [-n[0], -n[1], n[2]];
    if (turn === 3) return [n[1], -n[0], n[2]];
    return n;
  }
  function prepare(cfg) {
    if (!active) return false;
    const key = [active.name, cfg.length, cfg.width, cfg.cadFacing].join('|');
    if (key === preparedKey) return true;
    preparedKey = key;
    preparedFaces = active.faces.map((face) => Object.assign({}, face, { p: points(cfg, face), n: normal(cfg, face) }));
    preparedTop = preparedFaces.filter((face) => Math.abs(face.n[2]) > 0.12)
      .map((face) => ({ p: face.p, z: face.p.reduce((sum, p) => sum + p[2], 0) / face.p.length }))
      .sort((a, b) => a.z - b.z);
    return true;
  }
  function faces(cfg) {
    return prepare(cfg) ? preparedFaces : null;
  }
  function drawTop(ctx, cfg) {
    if (!prepare(cfg)) return false;
    ctx.fillStyle = '#8e9aa7';
    preparedTop.forEach((face) => {
      ctx.beginPath();
      ctx.moveTo(face.p[0][0], face.p[0][1]);
      ctx.lineTo(face.p[1][0], face.p[1][1]);
      ctx.lineTo(face.p[2][0], face.p[2][1]);
      ctx.closePath();
      ctx.fill();
    });
    ctx.strokeStyle = '#c3ccd4';
    ctx.lineWidth = 0.35;
    ctx.strokeRect(-cfg.length / 2, -cfg.width / 2, cfg.length, cfg.width);
    return true;
  }
  async function restore() { BBZ.CAD3D.active = await dbRequest('get'); return active; }
  async function save(mesh) { await dbRequest('put', mesh); }
  async function remove() { await dbRequest('delete'); BBZ.CAD3D.active = null; }

  BBZ.CAD3D = {
    read, save, restore, remove, faces, drawTop,
    get active() { return active; },
    set active(mesh) { active = mesh || null; preparedKey = ''; preparedFaces = []; preparedTop = []; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
