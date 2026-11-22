import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

const DURATION = 60 * 60 * 1000; // 1 jam

const sign = (exp, secret) => createHmac('sha256', secret).update(String(exp)).digest('hex');
const sha = (s) => createHash('sha256').update(String(s)).digest();

function verify(token, secret) {
  const [exp, sig] = String(token || '').split('.');
  if (!exp || !sig || !(Number(exp) > Date.now())) return false;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(exp, secret));
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const password = process.env.APP_PASSWORD;
  const secret = process.env.AUTH_SECRET;
  if (!password || !secret) {
    return res.status(500).json({ error: 'Server belum dikonfigurasi: isi APP_PASSWORD dan AUTH_SECRET di Vercel.' });
  }

  if (req.method === 'POST') {
    const input = req.body?.password ?? '';
    if (!timingSafeEqual(sha(input), sha(password))) {
      await new Promise((r) => setTimeout(r, 800));
      return res.status(401).json({ error: 'Kata sandi salah.' });
    }
    const exp = Date.now() + DURATION;
    return res.status(200).json({ token: `${exp}.${sign(exp, secret)}`, exp });
  }

  if (req.method === 'GET') {
    const token = (req.headers.authorization || '').replace(/^Bearer /, '');
    return verify(token, secret)
      ? res.status(200).json({ ok: true })
      : res.status(401).json({ error: 'Sesi berakhir.' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
