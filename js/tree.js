// ===== TREE.JS — D3.js Family Tree =====

let treeSvg, treeG, treeData, treeZoom;

function initTree(data) {
  treeData = data;
  const container = document.getElementById('tree-container');
  const width = container.clientWidth;
  const height = container.clientHeight;

  // Create SVG
  treeSvg = d3.select('#tree-container')
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  // Zoom group
  treeG = treeSvg.append('g');

  treeZoom = d3.zoom()
    .scaleExtent([0.3, 3])
    .on('zoom', (event) => {
      treeG.attr('transform', event.transform);
    });

  treeSvg.call(treeZoom);

  // Build and render
  renderTree();

  // Center the tree
  const initialTransform = d3.zoomIdentity.translate(width / 2 - 300, 40).scale(0.85);
  treeSvg.call(treeZoom.transform, initialTransform);
}

function renderTree() {
  const persons = treeData.persons;

  // Build hierarchy: find root couples and build a tree structure
  // We'll use a custom layout since family trees aren't strict hierarchies
  const layout = computeFamilyLayout(persons);

  // Clear previous
  treeG.selectAll('*').remove();

  // Draw spouse links (dashed)
  treeG.selectAll('.spouse-link')
    .data(layout.spouseLinks)
    .enter()
    .append('line')
    .attr('class', 'spouse-link')
    .attr('x1', d => d.x1)
    .attr('y1', d => d.y1)
    .attr('x2', d => d.x2)
    .attr('y2', d => d.y2);

  // Draw parent-child links (curved)
  treeG.selectAll('.link')
    .data(layout.parentChildLinks)
    .enter()
    .append('path')
    .attr('class', 'link')
    .attr('d', d => {
      const midY = (d.parentY + d.childY) / 2;
      return `M${d.parentX},${d.parentY} C${d.parentX},${midY} ${d.childX},${midY} ${d.childX},${d.childY}`;
    });

  // Draw nodes
  const nodes = treeG.selectAll('.node')
    .data(layout.nodes)
    .enter()
    .append('g')
    .attr('class', 'node')
    .attr('transform', d => `translate(${d.x}, ${d.y})`)
    .style('cursor', 'pointer')
    .on('click', (event, d) => {
      openPanel(d.id);
    });

  // Node circles — larger
  nodes.append('circle')
    .attr('class', 'node-circle')
    .attr('r', 20)
    .attr('data-id', d => d.id);

  // Name labels BELOW circle
  nodes.each(function(d) {
    const g = d3.select(this);
    const nameParts = splitName(d.name);
    const baseY = 32; // below circle

    if (nameParts.length === 1) {
      g.append('text')
        .attr('class', 'node-label')
        .attr('dy', baseY + 'px')
        .text(nameParts[0]);
    } else {
      g.append('text')
        .attr('class', 'node-label')
        .attr('dy', baseY + 'px')
        .text(nameParts[0]);
      g.append('text')
        .attr('class', 'node-label')
        .attr('dy', (baseY + 14) + 'px')
        .text(nameParts[1]);
    }
  });

  // Date labels below name
  nodes.each(function(d) {
    const g = d3.select(this);
    const nameParts = splitName(d.name);
    const nameLines = nameParts.length;
    const dateY = 32 + (nameLines * 14) + 4;

    const b = extractYear(d.birthDate);
    const de = extractYear(d.deathDate);
    let dateText = '';
    if (b && de) dateText = `${b} – ${de}`;
    else if (b) dateText = `${b} –`;
    else if (de) dateText = `– ${de}`;

    if (dateText) {
      g.append('text')
        .attr('class', 'node-dates')
        .attr('dy', dateY + 'px')
        .text(dateText);
    }
  });

  // Store node references for timeline updates
  layout.nodes.forEach(n => {
    n.element = treeG.selectAll('.node').filter(d => d.id === n.id);
  });

  window.treeLayout = layout;
}

function computeFamilyLayout(persons) {
  // Group by generation
  const generations = {};
  persons.forEach(p => {
    const gen = p.generation;
    if (!generations[gen]) generations[gen] = [];
    generations[gen].push(p);
  });

  const genKeys = Object.keys(generations).map(Number).sort();
  const nodeSpacingX = 140;
  const genSpacingY = 180;
  const nodes = [];
  const spouseLinks = [];
  const parentChildLinks = [];
  const posMap = {};

  // Layout each generation
  genKeys.forEach((gen, gi) => {
    const genPersons = generations[gen];
    const y = gi * genSpacingY + 60;

    // Group into couples
    const placed = new Set();
    const groups = [];

    genPersons.forEach(p => {
      if (placed.has(p.id)) return;
      placed.add(p.id);

      if (p.spouseId && APP.personsMap[p.spouseId] && APP.personsMap[p.spouseId].generation === gen && !placed.has(p.spouseId)) {
        groups.push([p, APP.personsMap[p.spouseId]]);
        placed.add(p.spouseId);
      } else {
        groups.push([p]);
      }
    });

    // Position groups
    const totalWidth = groups.reduce((sum, g) => sum + (g.length === 2 ? nodeSpacingX * 1.5 : nodeSpacingX), 0);
    let currentX = -totalWidth / 2;

    groups.forEach(group => {
      if (group.length === 2) {
        const x1 = currentX + nodeSpacingX * 0.375;
        const x2 = currentX + nodeSpacingX * 1.125;

        nodes.push({ ...group[0], x: x1, y });
        nodes.push({ ...group[1], x: x2, y });
        posMap[group[0].id] = { x: x1, y };
        posMap[group[1].id] = { x: x2, y };

        spouseLinks.push({ x1, y1: y, x2, y2: y });

        currentX += nodeSpacingX * 1.5;
      } else {
        const x = currentX + nodeSpacingX * 0.5;
        nodes.push({ ...group[0], x, y });
        posMap[group[0].id] = { x, y };
        currentX += nodeSpacingX;
      }
    });
  });

  // Build parent-child links
  persons.forEach(p => {
    if (p.father && posMap[p.father] && posMap[p.id]) {
      // Link from midpoint between father and mother (if both exist) to child
      const fatherPos = posMap[p.father];
      const motherPos = p.mother && posMap[p.mother] ? posMap[p.mother] : fatherPos;
      const parentMidX = (fatherPos.x + motherPos.x) / 2;
      const parentY = fatherPos.y + 20; // below circle (r=20)
      const childPos = posMap[p.id];

      parentChildLinks.push({
        parentX: parentMidX,
        parentY: parentY,
        childX: childPos.x,
        childY: childPos.y - 20 // above circle (r=20)
      });
    }
  });

  // Remove duplicate parent-child links (both father and mother would generate one)
  const uniqueLinks = [];
  const linkSet = new Set();
  parentChildLinks.forEach(l => {
    const key = `${l.parentX.toFixed(0)},${l.parentY.toFixed(0)},${l.childX.toFixed(0)},${l.childY.toFixed(0)}`;
    if (!linkSet.has(key)) {
      linkSet.add(key);
      uniqueLinks.push(l);
    }
  });

  return { nodes, spouseLinks, parentChildLinks: uniqueLinks, posMap };
}

function splitName(name) {
  if (name.length <= 14) return [name];
  // Try to split at a space near the middle
  const words = name.split(' ');
  if (words.length <= 2) return [words[0], words.slice(1).join(' ')];

  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
}

function getPersonLifespan(p) {
  const birth = extractYear(p.birthDate);
  const death = extractYear(p.deathDate);
  const marriage = extractYear(p.marriageDate);
  const earliest = [birth, death, marriage].filter(y => y !== null);
  if (earliest.length === 0) return { start: null, end: null };

  const start = birth || Math.min(...earliest);
  // If we know death, use it. Otherwise estimate: last known event + 60 years or last event
  const end = death || (start ? start + 70 : Math.max(...earliest));
  return { start, end };
}

function updateTreeForYear(year) {
  if (!window.treeLayout) return;

  const isFiltering = year < 2023;

  treeG.selectAll('.node').each(function(d) {
    const lifespan = getPersonLifespan(d);
    let isDimmed = false;
    let isPast = false;
    let isUnknown = false;

    if (isFiltering) {
      if (lifespan.start === null) {
        // Sin fecha conocida
        isUnknown = true;
      } else if (year < lifespan.start) {
        // Aún no ha nacido
        isDimmed = true;
      } else if (year > lifespan.end) {
        // Ya falleció — estilo pasado
        isPast = true;
      }
      // else: dentro de su rango de vida → visible normal
    }

    d3.select(this).selectAll('.node-circle')
      .classed('dimmed', isDimmed)
      .classed('past', isPast)
      .classed('unknown-date', isUnknown);
    d3.select(this).selectAll('.node-label')
      .classed('dimmed', isDimmed)
      .classed('past', isPast)
      .classed('unknown-date', isUnknown);
    d3.select(this).selectAll('.node-dates')
      .classed('dimmed', isDimmed)
      .classed('past', isPast)
      .classed('unknown-date', isUnknown);
  });

  // Dim links: if child is dimmed, dim the link
  treeG.selectAll('.link').each(function(d) {
    const childNode = treeData.persons.find(p => {
      const pos = window.treeLayout.posMap[p.id];
      return pos && Math.abs(pos.x - d.childX) < 1 && Math.abs(pos.y - 20 - d.childY) < 1;
    });
    let isDimmed = false;
    if (isFiltering && childNode) {
      const lifespan = getPersonLifespan(childNode);
      isDimmed = lifespan.start !== null && year < lifespan.start;
    }
    d3.select(this).classed('dimmed', isDimmed);
  });

  treeG.selectAll('.spouse-link').classed('dimmed', false);
}
