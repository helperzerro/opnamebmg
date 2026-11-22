<script>
  import { onMount } from 'svelte';

  const KEY = 'stock-opname-v1';
  const STATUS = [
    { v: 'sesuai', label: 'Sesuai' },
    { v: 'kurang', label: 'Kurang' },
    { v: 'lebih', label: 'Lebih' },
    { v: 'cek-ulang', label: 'Perlu cek ulang' }
  ];
  const labelOf = (v) => STATUS.find((s) => s.v === v)?.label ?? v;
  const has = (v) => v !== '' && v !== null && v !== undefined;
  const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const blank = () => ({ nama: '', stokTerakhir: '', stokFisik: '', tanggal: today(), status: 'sesuai', catatan: '' });
  const diff = (a, b) => Math.round((Number(a) - Number(b)) * 1000) / 1000;
  const num = (n) => Number(n).toLocaleString('id-ID');
  const signed = (d) => (d > 0 ? '+' : '') + num(d);
  const fmtDate = (s) =>
    new Date(s + 'T00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || [];
    } catch {
      return [];
    }
  }

  let items = $state(load());
  let form = $state(blank());
  let editId = $state(null);
  let statusTouched = $state(false);
  let q = $state('');
  let filter = $state('semua');

  // --- Login & sesi 1 jam ---
  const AUTH_KEY = 'stock-opname-auth';
  let authed = $state(null); // null = memeriksa, false = belum masuk, true = sudah masuk
  let expiry = $state(0);
  let password = $state('');
  let authError = $state('');
  let loggingIn = $state(false);

  function readSession() {
    try {
      return JSON.parse(localStorage.getItem(AUTH_KEY));
    } catch {
      return null;
    }
  }

  function logout() {
    try {
      localStorage.removeItem(AUTH_KEY);
    } catch {}
    authed = false;
    expiry = 0;
    password = '';
  }

  async function checkSession() {
    const s = readSession();
    if (!s || !s.token || s.exp <= Date.now()) return logout();
    try {
      const r = await fetch('/api/auth', { headers: { Authorization: 'Bearer ' + s.token } });
      if (r.ok) {
        expiry = s.exp;
        authed = true;
      } else logout();
    } catch {
      logout();
    }
  }

  async function login(e) {
    e.preventDefault();
    authError = '';
    loggingIn = true;
    try {
      const r = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        authError = data.error || 'Gagal masuk. Coba lagi.';
        return;
      }
      localStorage.setItem(AUTH_KEY, JSON.stringify({ token: data.token, exp: data.exp }));
      expiry = data.exp;
      authed = true;
      password = '';
    } catch {
      authError = 'Tidak bisa terhubung ke server.';
    } finally {
      loggingIn = false;
    }
  }

  onMount(checkSession);

  // Keluar otomatis saat sesi habis (dan cek ulang saat tab kembali aktif)
  $effect(() => {
    if (!authed) return;
    const t = setTimeout(logout, Math.max(expiry - Date.now(), 0));
    const onVisible = () => {
      if (Date.now() >= expiry) logout();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  });

  $effect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {}
  });

  const formDiff = $derived(has(form.stokFisik) && has(form.stokTerakhir) ? diff(form.stokFisik, form.stokTerakhir) : null);

  $effect(() => {
    if (formDiff !== null && !statusTouched) {
      form.status = formDiff === 0 ? 'sesuai' : formDiff < 0 ? 'kurang' : 'lebih';
    }
  });

  const counts = $derived({
    semua: items.length,
    sesuai: items.filter((i) => i.status === 'sesuai').length,
    kurang: items.filter((i) => i.status === 'kurang').length,
    lebih: items.filter((i) => i.status === 'lebih').length,
    'cek-ulang': items.filter((i) => i.status === 'cek-ulang').length
  });

  const shown = $derived(
    items
      .filter((i) => filter === 'semua' || i.status === filter)
      .filter((i) => i.nama.toLowerCase().includes(q.trim().toLowerCase()))
      .sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.id - a.id)
  );

  function reset() {
    form = blank();
    editId = null;
    statusTouched = false;
  }

  function save(e) {
    e.preventDefault();
    const data = {
      nama: form.nama.trim(),
      stokTerakhir: Number(form.stokTerakhir),
      stokFisik: Number(form.stokFisik),
      tanggal: form.tanggal,
      status: form.status,
      catatan: form.catatan.trim()
    };
    if (!data.nama) return;
    if (editId) {
      items = items.map((i) => (i.id === editId ? { ...i, ...data } : i));
    } else {
      items = [{ id: Date.now(), ...data }, ...items];
    }
    reset();
  }

  function edit(it) {
    form = {
      nama: it.nama,
      stokTerakhir: it.stokTerakhir,
      stokFisik: it.stokFisik,
      tanggal: it.tanggal,
      status: it.status,
      catatan: it.catatan
    };
    editId = it.id;
    statusTouched = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function remove(it) {
    if (!confirm(`Hapus "${it.nama}" dari daftar?`)) return;
    items = items.filter((i) => i.id !== it.id);
    if (editId === it.id) reset();
  }

  function exportCsv() {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [
      ['Nama Barang', 'Stok Terakhir', 'Stok Fisik', 'Selisih', 'Tanggal Pengecekan', 'Status', 'Catatan'],
      ...shown.map((i) => [i.nama, i.stokTerakhir, i.stokFisik, diff(i.stokFisik, i.stokTerakhir), i.tanggal, labelOf(i.status), i.catatan])
    ];
    const csv = '\ufeff' + rows.map((r) => r.map(esc).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-opname-${today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

{#if authed === null}
  <div class="gate"><p class="checking">Memeriksa sesi…</p></div>
{:else if authed === false}
  <div class="gate">
    <form class="login" onsubmit={login}>
      <h1>Stock Opname</h1>
      <p class="sub">Masukkan kata sandi untuk membuka halaman. Akses berlaku 1 jam.</p>
      <label>
        Kata sandi
        <input type="password" bind:value={password} autocomplete="current-password" required />
      </label>
      {#if authError}<p class="err" role="alert">{authError}</p>{/if}
      <button class="primary" type="submit" disabled={loggingIn}>{loggingIn ? 'Memeriksa…' : 'Masuk'}</button>
    </form>
  </div>
{:else}
<main class="app">
  <aside class="panel">
    <div class="head">
      <h1>Stock Opname</h1>
      <button class="ghost small" type="button" onclick={logout}>Keluar</button>
    </div>
    <p class="sub">Catat hasil hitung fisik dan bandingkan dengan stok terakhir.</p>

    <form onsubmit={save}>
      <label>
        Nama barang
        <input bind:value={form.nama} placeholder="mis. Pipa hitam 2 inci" required />
      </label>

      <div class="two">
        <label>
          Stok terakhir
          <input type="number" min="0" step="any" bind:value={form.stokTerakhir} required />
        </label>
        <label>
          Stok fisik
          <input type="number" min="0" step="any" bind:value={form.stokFisik} required />
        </label>
      </div>

      <div class="diff" class:neg={formDiff !== null && formDiff < 0} class:pos={formDiff !== null && formDiff > 0}>
        <span>Selisih</span>
        <strong>{formDiff === null ? '–' : signed(formDiff)}</strong>
      </div>

      <div class="two">
        <label>
          Tanggal pengecekan
          <input type="date" bind:value={form.tanggal} required />
        </label>
        <label>
          Status
          <select bind:value={form.status} onchange={() => (statusTouched = true)}>
            {#each STATUS as s}
              <option value={s.v}>{s.label}</option>
            {/each}
          </select>
        </label>
      </div>

      <label>
        Catatan
        <textarea rows="3" bind:value={form.catatan} placeholder="mis. 2 batang bengkok, di rak B"></textarea>
      </label>

      <div class="actions">
        <button class="primary" type="submit">{editId ? 'Simpan perubahan' : 'Tambah barang'}</button>
        {#if editId}
          <button class="ghost" type="button" onclick={reset}>Batal</button>
        {/if}
      </div>
    </form>
  </aside>

  <section class="content">
    <div class="toolbar">
      <input class="search" type="search" placeholder="Cari nama barang" bind:value={q} aria-label="Cari nama barang" />
      <button class="outline" type="button" onclick={exportCsv} disabled={!shown.length}>Ekspor CSV</button>
    </div>

    <div class="chips" role="group" aria-label="Filter status">
      {#each [{ v: 'semua', label: 'Semua' }, ...STATUS] as s}
        <button type="button" class="chip {s.v}" class:active={filter === s.v} aria-pressed={filter === s.v} onclick={() => (filter = s.v)}>
          {s.label}<b>{counts[s.v]}</b>
        </button>
      {/each}
    </div>

    {#if shown.length}
      <table>
        <thead>
          <tr>
            <th>Barang</th>
            <th class="r">Stok terakhir</th>
            <th class="r">Stok fisik</th>
            <th class="r">Selisih</th>
            <th>Tanggal</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each shown as it (it.id)}
            {@const d = diff(it.stokFisik, it.stokTerakhir)}
            <tr class:editing={editId === it.id}>
              <td class="name">
                <strong>{it.nama}</strong>
                {#if it.catatan}<small>{it.catatan}</small>{/if}
              </td>
              <td class="r" data-label="Stok terakhir">{num(it.stokTerakhir)}</td>
              <td class="r" data-label="Stok fisik">{num(it.stokFisik)}</td>
              <td class="r d" class:neg={d < 0} class:pos={d > 0} data-label="Selisih">{d === 0 ? '0' : signed(d)}</td>
              <td data-label="Tanggal">{fmtDate(it.tanggal)}</td>
              <td data-label="Status"><span class="badge {it.status}">{labelOf(it.status)}</span></td>
              <td class="acts">
                <button class="link" type="button" onclick={() => edit(it)}>Ubah</button>
                <button class="link danger" type="button" onclick={() => remove(it)}>Hapus</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else}
      <div class="empty">
        {#if items.length === 0}
          <strong>Belum ada barang</strong>
          <p>Isi formulir di samping untuk mencatat hasil opname pertama.</p>
        {:else}
          <strong>Tidak ada barang yang cocok</strong>
          <p>Ubah kata kunci pencarian atau filter status.</p>
        {/if}
      </div>
    {/if}
  </section>
</main>
{/if}

<style>
  :global(:root) {
    --ink: #12232b;
    --panel: #16303a;
    --paper: #edf0f1;
    --card: #ffffff;
    --line: #d5dbde;
    --muted: #5d6e76;
    --zinc: #e6c04a;
    --ok: #1e7b4f;
    --ok-bg: #ddf1e6;
    --bad: #b3261e;
    --bad-bg: #fbe3e0;
    --more: #1d5fa8;
    --more-bg: #ddeaf8;
    --warn: #8a5a00;
    --warn-bg: #fbefd0;
  }
  :global(*) { box-sizing: border-box; }
  :global(body) {
    margin: 0;
    background: var(--paper);
    color: var(--ink);
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
    font-size: 15px;
    line-height: 1.5;
  }
  button, input, select, textarea { font: inherit; color: inherit; }
  button { cursor: pointer; }
  :global(:focus-visible) { outline: 3px solid var(--zinc); outline-offset: 2px; }

  .app { display: grid; grid-template-columns: 370px 1fr; min-height: 100vh; }

  .panel {
    background: var(--panel);
    color: #e8eef0;
    padding: 36px 28px;
    position: sticky;
    top: 0;
    height: 100vh;
    overflow-y: auto;
  }
  h1 { margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.02em; }
  .sub { margin: 6px 0 28px; color: #9fb4bc; max-width: 30ch; }

  form { display: grid; gap: 16px; }
  label { display: grid; gap: 6px; font-size: 13px; font-weight: 600; color: #b9cad0; }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .panel input, .panel select, .panel textarea {
    width: 100%;
    background: #0f232b;
    border: 1px solid #2b4650;
    border-radius: 10px;
    padding: 10px 12px;
    color: #fff;
    font-weight: 500;
  }
  .panel input:focus, .panel select:focus, .panel textarea:focus { border-color: var(--zinc); outline: none; box-shadow: 0 0 0 3px #e6c04a33; }
  textarea { resize: vertical; }

  /* Hilangkan tombol atas-bawah pada input angka */
  input[type='number'] { appearance: textfield; -moz-appearance: textfield; }
  input[type='number']::-webkit-inner-spin-button,
  input[type='number']::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }

  .gate { min-height: 100vh; display: grid; place-items: center; padding: 24px; background: var(--panel); color: #e8eef0; }
  .checking { color: #9fb4bc; }
  .login { width: 100%; max-width: 360px; }
  .login .sub { margin-bottom: 8px; }
  .login input {
    width: 100%; background: #0f232b; border: 1px solid #2b4650; border-radius: 10px;
    padding: 10px 12px; color: #fff; font-weight: 500;
  }
  .login input:focus { border-color: var(--zinc); outline: none; box-shadow: 0 0 0 3px #e6c04a33; }
  .err { margin: 0; color: #ff9c92; font-size: 13px; font-weight: 600; }
  .primary:disabled { opacity: 0.6; cursor: wait; }
  .head { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
  .small { padding: 8px 14px; font-size: 13px; }

  .diff {
    display: flex; justify-content: space-between; align-items: baseline;
    padding: 12px 14px; border-radius: 10px;
    background: #0f232b; border: 1px dashed #36545f; color: #b9cad0; font-size: 13px; font-weight: 600;
  }
  .diff strong { font-size: 26px; font-weight: 800; color: #fff; font-variant-numeric: tabular-nums; }
  .diff.neg strong { color: #ff9c92; }
  .diff.pos strong { color: #8fc2f5; }

  .actions { display: flex; gap: 10px; margin-top: 4px; }
  .primary {
    flex: 1; border: 0; border-radius: 10px; padding: 12px 16px;
    background: var(--zinc); color: #2a2200; font-weight: 700;
  }
  .primary:hover { filter: brightness(1.06); }
  .ghost { background: transparent; border: 1px solid #36545f; border-radius: 10px; padding: 12px 16px; color: #d4e0e4; }

  .content { padding: 36px 40px; min-width: 0; }
  .toolbar { display: flex; gap: 12px; margin-bottom: 16px; }
  .search {
    flex: 1; background: var(--card); border: 1px solid var(--line);
    border-radius: 10px; padding: 11px 14px;
  }
  .outline { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 0 16px; font-weight: 600; }
  .outline:disabled { opacity: 0.45; cursor: not-allowed; }

  .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
  .chip {
    display: inline-flex; align-items: center; gap: 8px;
    background: var(--card); border: 1px solid var(--line); border-radius: 999px;
    padding: 6px 12px; font-size: 13px; font-weight: 600;
  }
  .chip b { font-variant-numeric: tabular-nums; color: var(--muted); font-weight: 700; }
  .chip.active { background: var(--ink); border-color: var(--ink); color: #fff; }
  .chip.active b { color: var(--zinc); }

  table { width: 100%; border-collapse: collapse; background: var(--card); border: 1px solid var(--line); border-radius: 14px; overflow: hidden; }
  th { text-align: left; font-size: 12.5px; font-weight: 600; color: var(--muted); padding: 12px 14px; background: #f7f9f9; border-bottom: 1px solid var(--line); }
  td { padding: 14px; border-bottom: 1px solid #e8ecee; vertical-align: top; }
  tr:last-child td { border-bottom: 0; }
  tr.editing td { background: #fff9e3; }
  .r { text-align: right; font-variant-numeric: tabular-nums; }
  .name strong { display: block; font-weight: 700; }
  .name small { display: block; color: var(--muted); margin-top: 2px; max-width: 32ch; }
  .d { font-weight: 800; }
  .d.neg { color: var(--bad); }
  .d.pos { color: var(--more); }

  .badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 12.5px; font-weight: 700; white-space: nowrap; }
  .badge.sesuai { background: var(--ok-bg); color: var(--ok); }
  .badge.kurang { background: var(--bad-bg); color: var(--bad); }
  .badge.lebih { background: var(--more-bg); color: var(--more); }
  .badge.cek-ulang { background: var(--warn-bg); color: var(--warn); }

  .acts { white-space: nowrap; text-align: right; }
  .link { background: none; border: 0; padding: 4px 6px; font-weight: 600; color: var(--ink); text-decoration: underline; text-underline-offset: 3px; }
  .link.danger { color: var(--bad); }

  .empty { background: var(--card); border: 1px dashed var(--line); border-radius: 14px; padding: 48px 24px; text-align: center; }
  .empty p { margin: 4px 0 0; color: var(--muted); }

  @media (max-width: 900px) {
    .app { grid-template-columns: 1fr; }
    .panel { position: static; height: auto; padding: 28px 20px; }
    .content { padding: 24px 16px 40px; }
    table, tbody, tr, td { display: block; }
    thead { display: none; }
    table { background: none; border: 0; }
    tr { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 6px 14px; margin-bottom: 12px; }
    td { border: 0; padding: 6px 0; display: flex; justify-content: space-between; gap: 12px; }
    td.name { display: block; padding-top: 10px; }
    td[data-label]::before { content: attr(data-label); color: var(--muted); font-size: 13px; font-weight: 600; }
    .acts { justify-content: flex-end; padding-bottom: 10px; }
  }
  @media (prefers-reduced-motion: no-preference) {
    .primary, .chip { transition: filter 0.15s, background 0.15s; }
  }
</style>
