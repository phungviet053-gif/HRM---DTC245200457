const express = require('express');
const { Pool } = require('pg');

const app = express();
const port = Number(process.env.PORT || 3000);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[c]));

async function initDb() {
  await pool.query(`
    INSERT INTO departments(name, description) VALUES
      ('Công nghệ thông tin', 'Phát triển và vận hành hệ thống'),
      ('Nhân sự', 'Tuyển dụng và quản lý nhân sự'),
      ('Kế toán', 'Quản lý tài chính')
    ON CONFLICT(name) DO NOTHING;
    INSERT INTO employees(employee_code, full_name, email, phone, position, department_id)
      SELECT 'NV001', 'Nguyễn Minh Anh', 'minhanh@example.com', '0900000001', 'Lập trình viên', id
      FROM departments WHERE name='Công nghệ thông tin'
      ON CONFLICT(employee_code) DO NOTHING;
  `);
}
const page = (title, body) => `<!doctype html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)} - HRM</title>
<style>
:root{font-family:Arial,sans-serif;color:#182230;background:#f3f6fb}*{box-sizing:border-box}
body{margin:0}.top{background:#142b4a;color:white;padding:22px max(20px,calc((100% - 1100px)/2))}
.top h1{margin:0 0 8px}.top a{color:#dbeafe;margin-right:18px}.wrap{max-width:1100px;margin:26px auto;padding:0 16px}
.card{background:white;border:1px solid #dce4ef;border-radius:12px;padding:20px;margin-bottom:18px;box-shadow:0 2px 8px #102a430a}
h2{margin-top:0;color:#17365d}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}
input,select{width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:7px;margin:5px 0 12px}
button,.btn{background:#1769aa;color:white;padding:10px 14px;border:0;border-radius:7px;cursor:pointer;text-decoration:none;display:inline-block}
table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px;border-bottom:1px solid #e2e8f0}th{background:#f8fafc}
.muted{color:#64748b}.pill{background:#e0f2fe;color:#075985;border-radius:20px;padding:4px 9px}
@media(max-width:600px){table{font-size:13px}.top a{display:inline-block;margin:5px}}
</style></head><body><header class="top"><h1>HRM · Quản lý nhân sự</h1>
<nav><a href="/">Tổng quan</a><a href="/employees">Nhân viên</a><a href="/departments">Phòng ban</a><a href="/attendance">Chấm công</a></nav></header>
<main class="wrap">${body}<p class="muted">Bản demo học tập · Node.js + PostgreSQL · triển khai bằng Docker Compose</p></main></body></html>`;

app.get('/health', async (req, res) => {
  try { await pool.query('SELECT 1'); res.json({ status: 'ok', database: 'connected' }); }
  catch (e) { console.error('health database error:', e.message); res.status(503).json({ status: 'error' }); }
});

app.get('/', async (req,res) => {
  try {
    const [e,d,a] = await Promise.all([
      pool.query('SELECT COUNT(*)::int n FROM employees'),
      pool.query('SELECT COUNT(*)::int n FROM departments'),
      pool.query('SELECT COUNT(*)::int n FROM attendance WHERE work_date=CURRENT_DATE')
    ]);
    res.send(page('Tổng quan', `<section class="card"><h2>Xin chào!</h2><p>Hệ thống quản lý nhân sự cơ bản: hồ sơ nhân viên, phòng ban và chấm công.</p>
    <div class="grid"><div class="card"><span class="muted">Nhân viên</span><h2>${e.rows[0].n}</h2></div>
    <div class="card"><span class="muted">Phòng ban</span><h2>${d.rows[0].n}</h2></div>
    <div class="card"><span class="muted">Lượt chấm công hôm nay</span><h2>${a.rows[0].n}</h2></div></div></section>
    <section class="card"><h2>Thành phần hệ thống</h2><p>Website: <a href="/employees">Quản lý nhân viên</a> · <a href="/departments">Phòng ban</a> · <a href="/attendance">Chấm công</a></p>
    <p>Công cụ vận hành: <a href="/pgadmin/">pgAdmin</a> · <a href="/grafana/">Grafana</a> · <a href="/prometheus/">Prometheus</a> · <a href="/loki/">Loki API</a></p></section>`));
  } catch(e) { console.error('dashboard error:', e.message); res.status(500).send('Không tải được trang tổng quan. Kiểm tra log ứng dụng.'); }
});

app.get('/employees', async (req,res) => {
  try {
    const [emps,depts] = await Promise.all([
      pool.query(`SELECT e.*, d.name department FROM employees e LEFT JOIN departments d ON d.id=e.department_id ORDER BY e.id DESC`),
      pool.query('SELECT id,name FROM departments ORDER BY name')
    ]);
    const rows = emps.rows.map(e=>`<tr><td>${e.id}</td><td>${esc(e.employee_code)}</td><td>${esc(e.full_name)}</td><td>${esc(e.email)}</td><td>${esc(e.position)}</td><td>${esc(e.department||'—')}</td><td><a class="btn" href="/employees/${e.id}/edit">Sửa</a> <form method="post" action="/employees/${e.id}/delete" onsubmit="return confirm('Xóa nhân viên này?')" style="display:inline"><button> Xóa </button></form></td></tr>`).join('');
    const opts = depts.rows.map(d=>`<option value="${d.id}">${esc(d.name)}</option>`).join('');
    res.send(page('Nhân viên', `<section class="card"><h2>Thêm nhân viên</h2><form method="post" action="/employees" class="grid">
      <label>Mã nhân viên<input name="employee_code" required maxlength="30" placeholder="NV002"></label>
      <label>Họ và tên<input name="full_name" required maxlength="120"></label>
      <label>Email<input type="email" name="email" maxlength="150"></label>
      <label>Số điện thoại<input name="phone" maxlength="30"></label>
      <label>Chức vụ<input name="position" maxlength="100"></label>
      <label>Phòng ban<select name="department_id"><option value="">Chưa phân phòng</option>${opts}</select></label>
      <div><button type="submit">Thêm nhân viên</button></div></form></section>
      <section class="card"><h2>Danh sách nhân viên</h2><div style="overflow:auto"><table><thead><tr><th>ID</th><th>Mã NV</th><th>Họ tên</th><th>Email</th><th>Chức vụ</th><th>Phòng ban</th><th>Thao tác</th></tr></thead><tbody>${rows||'<tr><td colspan="7">Chưa có dữ liệu</td></tr>'}</tbody></table></div></section>`));
  } catch(e) { console.error('employees list error:',e.message); res.status(500).send('Lỗi tải danh sách nhân viên'); }
});
app.get('/employees/:id/edit', async (req,res) => {
  const id=Number(req.params.id);
  if(!Number.isInteger(id)||id<1) return res.status(400).send('ID nhân viên không hợp lệ');
  try {
    const [employee,depts]=await Promise.all([
      pool.query('SELECT * FROM employees WHERE id=$1',[id]),
      pool.query('SELECT id,name FROM departments ORDER BY name')
    ]);
    if(!employee.rowCount) return res.status(404).send('Không tìm thấy nhân viên');
    const e=employee.rows[0];
    const opts=depts.rows.map(d=>`<option value="${d.id}" ${d.id===e.department_id?'selected':''}>${esc(d.name)}</option>`).join('');
    res.send(page('Sửa nhân viên',`<section class="card"><h2>Sửa thông tin nhân viên</h2>
      <form method="post" action="/employees/${id}/edit" class="grid">
      <label>Mã nhân viên<input name="employee_code" required maxlength="30" value="${esc(e.employee_code)}"></label>
      <label>Họ và tên<input name="full_name" required maxlength="120" value="${esc(e.full_name)}"></label>
      <label>Email<input type="email" name="email" maxlength="150" value="${esc(e.email)}"></label>
      <label>Số điện thoại<input name="phone" maxlength="30" value="${esc(e.phone)}"></label>
      <label>Chức vụ<input name="position" maxlength="100" value="${esc(e.position)}"></label>
      <label>Phòng ban<select name="department_id"><option value="">Chưa phân phòng</option>${opts}</select></label>
      <div><button type="submit">Lưu thay đổi</button> <a href="/employees">Hủy</a></div></form></section>`));
  } catch(e) { console.error('employee edit form error:',e.message); res.status(500).send('Lỗi tải thông tin nhân viên'); }
});
app.post('/employees', async (req,res) => {
  try {
    const {employee_code,full_name,email,phone,position,department_id}=req.body;
    await pool.query('INSERT INTO employees(employee_code,full_name,email,phone,position,department_id) VALUES($1,$2,$3,$4,$5,$6)',
      [employee_code.trim(),full_name.trim(),email||null,phone||null,position||null,department_id||null]);
    console.info('employee created:', employee_code); res.redirect('/employees');
  } catch(e) { console.error('employee create error:',e.message); res.status(400).send('Không thêm được nhân viên. Kiểm tra mã nhân viên/email có bị trùng không. <a href="/employees">Quay lại</a>'); }
});
app.post('/employees/:id/edit', async (req,res) => {
  const id=Number(req.params.id);
  if(!Number.isInteger(id)||id<1) return res.status(400).send('ID nhân viên không hợp lệ');
  try {
    const {employee_code,full_name,email,phone,position,department_id}=req.body;
    if(typeof employee_code!=='string'||typeof full_name!=='string'||!employee_code.trim()||!full_name.trim()) {
      return res.status(400).send('Mã nhân viên và họ tên là bắt buộc');
    }
    const result=await pool.query(`UPDATE employees SET employee_code=$1,full_name=$2,email=$3,phone=$4,position=$5,department_id=$6 WHERE id=$7`,
      [employee_code.trim(),full_name.trim(),email||null,phone||null,position||null,department_id||null,id]);
    if(!result.rowCount) return res.status(404).send('Không tìm thấy nhân viên');
    console.info('employee updated:',id); res.redirect('/employees');
  } catch(e) { console.error('employee update error:',e.message); res.status(400).send('Không cập nhật được nhân viên. Kiểm tra mã nhân viên/email có bị trùng không. <a href="/employees">Quay lại</a>'); }
});
app.post('/employees/:id/delete', async (req,res) => {
  try { await pool.query('DELETE FROM employees WHERE id=$1',[Number(req.params.id)]); console.info('employee deleted:',req.params.id); res.redirect('/employees'); }
  catch(e) { console.error('employee delete error:',e.message); res.status(400).send('Không xóa được nhân viên'); }
});

app.get('/departments', async (req,res) => {
  try {
    const result=await pool.query(`SELECT d.*,COUNT(e.id)::int employee_count FROM departments d LEFT JOIN employees e ON e.department_id=d.id GROUP BY d.id ORDER BY d.id`);
    const rows=result.rows.map(d=>`<tr><td>${d.id}</td><td>${esc(d.name)}</td><td>${esc(d.description)}</td><td>${d.employee_count}</td><td><a class="btn" href="/departments/${d.id}/edit">Sửa</a> <form method="post" action="/departments/${d.id}/delete" onsubmit="return confirm('Xóa phòng ban này? Nhân viên sẽ được chuyển sang chưa phân phòng.')" style="display:inline"><button>Xóa</button></form></td></tr>`).join('');
    res.send(page('Phòng ban',`<section class="card"><h2>Thêm phòng ban</h2><form method="post" action="/departments" class="grid"><label>Tên phòng ban<input name="name" required maxlength="100"></label><label>Mô tả<input name="description" maxlength="250"></label><div><button>Thêm phòng ban</button></div></form></section>
    <section class="card"><h2>Danh sách phòng ban</h2><table><thead><tr><th>ID</th><th>Tên</th><th>Mô tả</th><th>Số nhân viên</th><th>Thao tác</th></tr></thead><tbody>${rows}</tbody></table></section>`));
  } catch(e) { console.error('departments list error:',e.message); res.status(500).send('Lỗi tải phòng ban'); }
});
app.get('/departments/:id/edit', async (req,res) => {
  const id=Number(req.params.id);
  if(!Number.isInteger(id)||id<1) return res.status(400).send('ID phòng ban không hợp lệ');
  try {
    const result=await pool.query('SELECT * FROM departments WHERE id=$1',[id]);
    if(!result.rowCount) return res.status(404).send('Không tìm thấy phòng ban');
    const d=result.rows[0];
    res.send(page('Sửa phòng ban',`<section class="card"><h2>Sửa phòng ban</h2>
      <form method="post" action="/departments/${id}/edit" class="grid">
      <label>Tên phòng ban<input name="name" required maxlength="100" value="${esc(d.name)}"></label>
      <label>Mô tả<input name="description" maxlength="250" value="${esc(d.description)}"></label>
      <div><button type="submit">Lưu thay đổi</button> <a href="/departments">Hủy</a></div></form></section>`));
  } catch(e) { console.error('department edit form error:',e.message); res.status(500).send('Lỗi tải thông tin phòng ban'); }
});
app.post('/departments',async(req,res)=>{
  try { await pool.query('INSERT INTO departments(name,description) VALUES($1,$2)',[req.body.name.trim(),req.body.description||'']); console.info('department created'); res.redirect('/departments'); }
  catch(e) { console.error('department create error:',e.message); res.status(400).send('Không thêm được phòng ban (có thể tên đã tồn tại). <a href="/departments">Quay lại</a>'); }
});
app.post('/departments/:id/edit',async(req,res)=>{
  const id=Number(req.params.id);
  if(!Number.isInteger(id)||id<1) return res.status(400).send('ID phòng ban không hợp lệ');
  try {
    if(typeof req.body.name!=='string'||!req.body.name.trim()) return res.status(400).send('Tên phòng ban là bắt buộc');
    const result=await pool.query('UPDATE departments SET name=$1,description=$2 WHERE id=$3',[req.body.name.trim(),req.body.description||'',id]);
    if(!result.rowCount) return res.status(404).send('Không tìm thấy phòng ban');
    console.info('department updated:',id); res.redirect('/departments');
  } catch(e) { console.error('department update error:',e.message); res.status(400).send('Không cập nhật được phòng ban (có thể tên đã tồn tại). <a href="/departments">Quay lại</a>'); }
});
app.post('/departments/:id/delete',async(req,res)=>{
  const id=Number(req.params.id);
  if(!Number.isInteger(id)||id<1) return res.status(400).send('ID phòng ban không hợp lệ');
  try {
    await pool.query('DELETE FROM departments WHERE id=$1',[id]);
    console.info('department deleted:',id); res.redirect('/departments');
  } catch(e) { console.error('department delete error:',e.message); res.status(400).send('Không xóa được phòng ban'); }
});

app.get('/attendance',async(req,res)=>{
  try {
    const [emps,att]=await Promise.all([
      pool.query('SELECT id,employee_code,full_name FROM employees ORDER BY full_name'),
      pool.query(`SELECT a.*,e.employee_code,e.full_name FROM attendance a JOIN employees e ON e.id=a.employee_id ORDER BY work_date DESC,id DESC LIMIT 100`)
    ]);
    const opts=emps.rows.map(e=>`<option value="${e.id}">${esc(e.employee_code)} — ${esc(e.full_name)}</option>`).join('');
    const rows=att.rows.map(a=>`<tr><td>${esc(a.work_date.toISOString ? a.work_date.toISOString().slice(0,10) : a.work_date)}</td><td>${esc(a.employee_code)}</td><td>${esc(a.full_name)}</td><td>${esc(a.check_in||'—')}</td><td>${esc(a.check_out||'—')}</td><td>${esc(a.note||'')}</td><td><form method="post" action="/attendance/${a.id}/delete" onsubmit="return confirm('Xóa bản ghi chấm công này?')"><button>Xóa</button></form></td></tr>`).join('');
    res.send(page('Chấm công',`<section class="card"><h2>Ghi nhận chấm công</h2><form method="post" action="/attendance" class="grid">
    <label>Nhân viên<select name="employee_id" required>${opts}</select></label><label>Ngày<input type="date" name="work_date" value="${new Date().toISOString().slice(0,10)}" required></label>
    <label>Giờ vào<input type="time" name="check_in"></label><label>Giờ ra<input type="time" name="check_out"></label><label>Ghi chú<input name="note" maxlength="250"></label><div><button>Ghi nhận</button></div></form>
    <p class="muted">Mỗi nhân viên chỉ có một bản ghi mỗi ngày; gửi lại sẽ cập nhật giờ vào/ra.</p></section>
    <section class="card"><h2>Lịch sử chấm công (100 bản ghi gần nhất)</h2><div style="overflow:auto"><table><thead><tr><th>Ngày</th><th>Mã NV</th><th>Nhân viên</th><th>Giờ vào</th><th>Giờ ra</th><th>Ghi chú</th><th>Thao tác</th></tr></thead><tbody>${rows||'<tr><td colspan="7">Chưa có dữ liệu</td></tr>'}</tbody></table></div></section>`));
  } catch(e) { console.error('attendance list error:',e.message); res.status(500).send('Lỗi tải chấm công'); }
});
app.post('/attendance',async(req,res)=>{
  try {
    const {employee_id,work_date,check_in,check_out,note}=req.body;
    await pool.query(`INSERT INTO attendance(employee_id,work_date,check_in,check_out,note) VALUES($1,$2,$3,$4,$5)
      ON CONFLICT(employee_id,work_date) DO UPDATE SET check_in=EXCLUDED.check_in,check_out=EXCLUDED.check_out,note=EXCLUDED.note`,
      [Number(employee_id),work_date,check_in||null,check_out||null,note||null]);
    console.info('attendance saved for employee:',employee_id); res.redirect('/attendance');
  } catch(e) { console.error('attendance save error:',e.message); res.status(400).send('Không lưu được chấm công. <a href="/attendance">Quay lại</a>'); }
});
app.post('/attendance/:id/delete',async(req,res)=>{
  const id=Number(req.params.id);
  if(!Number.isInteger(id)||id<1) return res.status(400).send('ID chấm công không hợp lệ');
  try {
    await pool.query('DELETE FROM attendance WHERE id=$1',[id]);
    console.info('attendance deleted:',id); res.redirect('/attendance');
  } catch(e) { console.error('attendance delete error:',e.message); res.status(400).send('Không xóa được bản ghi chấm công'); }
});

initDb().then(()=>app.listen(port,'0.0.0.0',()=>console.log(`HRM app listening on ${port}`)))
  .catch(err=>{ console.error('database initialization failed:',err.message); process.exit(1); });
