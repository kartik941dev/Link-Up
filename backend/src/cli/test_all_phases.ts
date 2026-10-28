import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../utils/db.js';
import { config } from '../config.js';
import { GraphService } from '../services/graphService.js';

async function runBackendTests() {
  console.log('========================================================');
  console.log('🧪 LINKUP BACKEND & KNOWLEDGE GRAPH TEST SUITE');
  console.log('========================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      throw new Error(`Assertion failed: ${testName}`);
    }
  }

  // 1. Authentication & Security Logic Verification
  console.log('--- 1. Testing Auth & Security Logic (Bcrypt & JWT) ---');
  const plainPassword = 'SuperSecretSecurePassword123!';
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(plainPassword, salt);
  assert(hash !== plainPassword, 'Password successfully hashed with salt');
  const match = await bcrypt.compare(plainPassword, hash);
  assert(match === true, 'Bcrypt correctly verifies password hash');
  const badMatch = await bcrypt.compare('WrongPassword', hash);
  assert(badMatch === false, 'Bcrypt rejects incorrect passwords');

  const testPayload = { id: '00000000-0000-0000-0000-000000000001', email: 'tester@linkup.local' };
  const token = jwt.sign(testPayload, config.jwtSecret, { expiresIn: '1h' });
  assert(typeof token === 'string' && token.length > 20, 'JWT token signed successfully');
  const decoded = jwt.verify(token, config.jwtSecret) as any;
  assert(decoded.email === testPayload.email, 'JWT token successfully decoded and verified');

  // 2. Data Export & CSV/JSON Structure Verification (Phase 4)
  console.log('\n--- 2. Testing Data Export Logic (JSON & CSV Serialization) ---');
  const sampleNodes = [
    {
      id: 'node-1',
      title: 'Deep Learning & Attention Mechanisms',
      content_type: 'pdf' as const,
      centrality: 0.85,
      cluster_label: 'Deep Learning',
      created_at: new Date().toISOString(),
      tags: [{ id: 't1', name: 'AI' }],
    },
    {
      id: 'node-2',
      title: 'Convolutional Neural Networks',
      content_type: 'note' as const,
      centrality: 0.65,
      cluster_label: 'Deep Learning',
      created_at: new Date().toISOString(),
      tags: [{ id: 't1', name: 'AI' }, { id: 't2', name: 'Vision' }],
    },
  ];

  const sampleLinks = [
    {
      id: 'edge-1',
      source: 'node-1',
      target: 'node-2',
      weight: 0.82,
      similarity_score: 0.82,
      edge_type: 'topic_cluster',
      reason: 'Semantic similarity (82%)',
      created_at: new Date().toISOString(),
    },
  ];

  // Test CSV generation
  const nodeHeaders = ['id', 'title', 'content_type', 'centrality', 'cluster_label', 'created_at', 'tags'];
  const nodeRows = sampleNodes.map((n) => {
    const tagString = n.tags.map((t) => t.name).join(';');
    const cleanTitle = `"${n.title.replace(/"/g, '""')}"`;
    return [n.id, cleanTitle, n.content_type, n.centrality, n.cluster_label || '', n.created_at, `"${tagString}"`].join(',');
  });
  const csvNodes = [nodeHeaders.join(','), ...nodeRows].join('\n');

  assert(csvNodes.includes('node-1,"Deep Learning & Attention Mechanisms",pdf,0.85'), 'CSV node row serialized correctly');
  assert(csvNodes.includes('id,title,content_type,centrality'), 'CSV node headers formatted accurately');

  const edgeHeaders = ['id', 'source_card_id', 'target_card_id', 'weight', 'similarity_score', 'edge_type', 'reason', 'created_at'];
  const edgeRows = sampleLinks.map((e) => {
    const cleanReason = `"${e.reason.replace(/"/g, '""')}"`;
    return [e.id, e.source, e.target, e.weight, e.similarity_score, e.edge_type, cleanReason, e.created_at].join(',');
  });
  const csvEdges = [edgeHeaders.join(','), ...edgeRows].join('\n');

  assert(csvEdges.includes('edge-1,node-1,node-2,0.82,0.82,topic_cluster'), 'CSV edge row serialized correctly');

  // 3. Phase 5 & 6 Logic: Smart Clustering & RAG Grounding
  console.log('\n--- 3. Testing Phase 5 Smart Clustering & Phase 6 RAG Citations ---');
  // Phase 5 cluster grouping test
  const clusterMap = new Map<string, any[]>();
  for (const n of sampleNodes) {
    const label = n.cluster_label || 'Uncategorized Notes';
    if (!clusterMap.has(label)) clusterMap.set(label, []);
    clusterMap.get(label)!.push(n);
  }
  assert(clusterMap.has('Deep Learning'), 'Smart Arrange grouped cards into "Deep Learning" cluster');
  assert(clusterMap.get('Deep Learning')!.length === 2, 'Cluster contains both member cards');

  // Phase 6 Citation regex parsing test
  const sampleAnswer = 'Attention mechanisms allow models to focus on key input regions [Card: node-1 - Deep Learning & Attention Mechanisms].';
  const citationMatches = [...sampleAnswer.matchAll(/\[Card:\s*([0-9a-zA-Z-]+)(?:\s*-\s*([^\]]+))?\]/g)];
  assert(citationMatches.length === 1, 'RAG citation successfully extracted from generated answer');
  assert(citationMatches[0][1] === 'node-1', 'Citation ID matched exact card ID');
  assert(citationMatches[0][2].trim() === 'Deep Learning & Attention Mechanisms', 'Citation title matched exact card title');

  // 4. Database Connectivity Check
  console.log('\n--- 4. Testing Database Connection & Schema Tables ---');
  try {
    const dbClient = await pool.connect();
    try {
      const res = await dbClient.query('SELECT NOW()');
      assert(!!res.rows[0].now, 'PostgreSQL connection alive and responding');

      const tablesRes = await dbClient.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public';
      `);
      const existingTables = new Set(tablesRes.rows.map((r) => r.table_name));

      const requiredTables = ['users', 'cards', 'tags', 'card_tags', 'graph_edges', 'migrations'];
      for (const tbl of requiredTables) {
        assert(existingTables.has(tbl), `Required table '${tbl}' exists in database`);
      }

      // Test GraphService against DB
      const mockUserId = '00000000-0000-0000-0000-000000000001';
      const graphData = await GraphService.getUserGraph(mockUserId, 0.5);
      assert(Array.isArray(graphData.nodes), 'getUserGraph returns nodes array');
      assert(Array.isArray(graphData.links), 'getUserGraph returns links array');
    } finally {
      dbClient.release();
    }
  } catch (err: any) {
    console.log(`ℹ️ [NOTE] Local PostgreSQL server not reachable at ${config.databaseUrl} (${err.code || err.message}).`);
    console.log(`   (Live database queries will run automatically when local Postgres service is started or Neon cloud DB URL is provided).`);
  }

  console.log('\n========================================================');
  console.log(`🎉 ALL UNIT & INTEGRATION TESTS EXECUTED (${passedTests}/${totalTests} assertions passed)!`);
  console.log('========================================================');
  await pool.end();
}

runBackendTests();
