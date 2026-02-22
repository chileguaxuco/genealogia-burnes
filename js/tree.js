// ===== TREE.JS — D3.js Family Tree (ES module) =====

import { extractYear } from './utils.js';
import { openPanel } from './panel.js';

let treeSvg, treeG, treeData, treeZoom;

export function initTree(data) {
  treeData = data;
  const container = document.getElementById('tree-container');
  const width  = container.clientWidth;
  const height = container.clientHeight;

  treeSvg = d3.select('#tree-container')
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  treeG = treeSvg.append('g');

  treeZoom = d3.zoom()
    .scaleExtent([0.3, 3])
    .on('zoom', (event) => {
      treeG.attr('transform', event.transform);
    });

  treeSvg.call(treeZoom);

  renderTree();

  const initialTransform = d3.zoomIdentity.translate(width / 2 - 300, 40).scale(0.85);
  treeSvg.call(treeZoom.transform, initialTransform);

  // Expose zoom-to-node for app.js / search
  window.zoomToTreeNode = zoomToNode;
}

function renderTree() {
  const persons = treeData.persons;
  const layout  = computeFamilyLayout(persons);

  treeG.selectAll('*').remove();

  // Spouse links
  treeG.selectAll('.spouse-link')
    .data(layout.spouseLinks)
    .enter()
    .append('line')
    .attr('class', 'spouse-link')
    .attr('x1', d => d.x1).attr('y1', d => d.y1)
    .attr('x2', d => d.x2).attr('y2', d => d.y2);

  // Parent-child links
  treeG.selectAll('.link')
    .data(layout.parentChildLinks)
    .enter()
    .append('path')
    .attr('class', 'link')
    .attr('d', d => {
      const midY = (d.parentY + d.childY) / 2;
      return `M${d.parentX},${d.parentY} C${d.parentX},${midY} ${d.childX},${midY} ${d.childX},${d.childY}`;
    });

  // Nodes
  const nodes = treeG.selectAll('.node')
    .data(layout.nodes)
    .enter()
    .append('g')
    .attr('class', 'node')
    .attr('transform', d => `translate(${d.x}, ${d.y})`)
    .style('cursor', 'pointer')
    .on('click', (event, d) => openPanel(d.id));

  nodes.append('circle')
    .attr('class', 'node-circle')
    .attr('r', 20)
    .attr('data-id', d => d.id);

  // Name labels
  nodes.each(function(d) {
    const g = d3.select(this);
    const nameParts = splitName(d.name);
    const baseY = 32;
    nameParts.forEach((part, i) => {
      g.append('text')
        .attr('class', 'node-label')
        .attr('dy', (baseY + i * 14) + 'px')
        .text(part);
    });
  });

  // Date labels
  nodes.each(function(d) {
    const g = d3.select(this);
    const nameParts = splitName(d.name);
    const dateY = 32 + (nameParts.length * 14) + 4;
    const b  = extractYear(d.birthDate);
    const de = extractYear(d.deathDate);
    const dateText = b && de ? `${b} – ${de}` : b ? `${b} –` : de ? `– ${de}` : '';
    if (dateText) {
      g.append('text')
        .attr('class', 'node-dates')
        .attr('dy', dateY + 'px')
        .text(dateText);
    }
  });

  window.treeLayout = layout;
}

// ---- Zoom/highlight a node by ID ----
function zoomToNode(personId) {
  if (!window.treeLayout) return;
  const node = window.treeLayout.nodes.find(n => n.id === personId);
  if (!node) return;

  const container = document.getElementById('tree-container');
  const w = container.clientWidth;
  const h = container.clientHeight;
  const scale = 1.4;
  const tx = w / 2 - node.x * scale;
  const ty = h / 2 - node.y * scale;

  treeSvg.transition()
    .duration(600)
    .ease(d3.easeCubicOut)
    .call(treeZoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));

  // Pulse highlight
  treeG.selectAll('.node-circle')
    .filter(d => d && d.id === personId)
    .classed('search-highlight', true);

  setTimeout(() => {
    treeG.selectAll('.node-circle')
      .filter(d => d && d.id === personId)
      .classed('search-highlight', false);
  }, 1400);
}

// ---- Timeline update with D3 transitions ----
export function updateTreeForYear(year) {
  if (!window.treeLayout) return;
  const isFiltering = year < 2023;

  treeG.selectAll('.node').each(function(d) {
    const lifespan = getPersonLifespan(d);
    let isDimmed = false, isPast = false, isUnknown = false;
    if (isFiltering) {
      if (lifespan.start === null)    isUnknown = true;
      else if (year < lifespan.start) isDimmed  = true;
      else if (year > lifespan.end)   isPast    = true;
    }
    const el = d3.select(this);

    // Animate radius: shrink when dimmed/not-yet-born, restore otherwise
    const targetR = isDimmed ? 14 : (isPast ? 16 : 20);
    el.selectAll('.node-circle')
      .transition().duration(380).ease(d3.easeCubicOut)
      .attr('r', targetR)
      .selection()
      .classed('dimmed', isDimmed).classed('past', isPast).classed('unknown-date', isUnknown);

    el.selectAll('.node-label')
      .classed('dimmed', isDimmed).classed('past', isPast).classed('unknown-date', isUnknown);
    el.selectAll('.node-dates')
      .classed('dimmed', isDimmed).classed('past', isPast).classed('unknown-date', isUnknown);
  });

  treeG.selectAll('.link').each(function(d) {
    const childNode = treeData.persons.find(p => {
      const pos = window.treeLayout.posMap[p.id];
      return pos && Math.abs(pos.x - d.childX) < 1 && Math.abs(pos.y - 20 - d.childY) < 1;
    });
    let isDimmed = false;
    if (isFiltering && childNode) {
      const ls = getPersonLifespan(childNode);
      isDimmed = ls.start !== null && year < ls.start;
    }
    d3.select(this).classed('dimmed', isDimmed);
  });

  treeG.selectAll('.spouse-link').classed('dimmed', false);
}

// ---- Layout engine ----
function computeFamilyLayout(persons) {
  // Build local lookup to avoid importing APP
  const personsMap = {};
  persons.forEach(p => { personsMap[p.id] = p; });

  const generations = {};
  persons.forEach(p => {
    if (!generations[p.generation]) generations[p.generation] = [];
    generations[p.generation].push(p);
  });

  const genKeys = Object.keys(generations).map(Number).sort();
  const nodeSpacingX = 140, genSpacingY = 180;
  const nodes = [], spouseLinks = [], parentChildLinks = [], posMap = {};

  genKeys.forEach((gen, gi) => {
    const genPersons = generations[gen];
    const y = gi * genSpacingY + 60;
    const placed = new Set();
    const groups = [];

    genPersons.forEach(p => {
      if (placed.has(p.id)) return;
      placed.add(p.id);
      if (p.spouseId && personsMap[p.spouseId] &&
          personsMap[p.spouseId].generation === gen && !placed.has(p.spouseId)) {
        groups.push([p, personsMap[p.spouseId]]);
        placed.add(p.spouseId);
      } else {
        groups.push([p]);
      }
    });

    const totalWidth = groups.reduce((sum, g) =>
      sum + (g.length === 2 ? nodeSpacingX * 1.5 : nodeSpacingX), 0);
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

  const linkSet = new Set();
  persons.forEach(p => {
    if (!p.father || !posMap[p.father] || !posMap[p.id]) return;
    const fPos = posMap[p.father];
    const mPos = p.mother && posMap[p.mother] ? posMap[p.mother] : fPos;
    const parentMidX = (fPos.x + mPos.x) / 2;
    const parentY    = fPos.y + 20;
    const childPos   = posMap[p.id];
    const key = `${parentMidX.toFixed(0)},${parentY},${childPos.x},${childPos.y}`;
    if (!linkSet.has(key)) {
      linkSet.add(key);
      parentChildLinks.push({ parentX: parentMidX, parentY, childX: childPos.x, childY: childPos.y - 20 });
    }
  });

  return { nodes, spouseLinks, parentChildLinks, posMap };
}

function splitName(name) {
  if (name.length <= 14) return [name];
  const words = name.split(' ');
  if (words.length <= 2) return [words[0], words.slice(1).join(' ')];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
}

function getPersonLifespan(p) {
  const birth    = extractYear(p.birthDate);
  const death    = extractYear(p.deathDate);
  const marriage = extractYear(p.marriageDate);
  const all      = [birth, death, marriage].filter(y => y !== null);
  if (!all.length) return { start: null, end: null };
  const start = birth || Math.min(...all);
  const end   = death || (start ? start + 70 : Math.max(...all));
  return { start, end };
}
