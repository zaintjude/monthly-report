// email.js
// Node.js script to generate monthly PDF report and email it

const fs = require("fs");
const path = require("path");
const { jsPDF } = require("jspdf");
require("jspdf-autotable");
const ChartjsNode = require("chartjs-node-canvas");
const nodemailer = require("nodemailer");

// === CONFIGURATION ===
const senderEmail = "judedabon123@gmail.com"; // your Gmail sender
const appPassword = "flgjmtgcnmgeyvdw"; // your Gmail App Password (remove spaces)
const recipients = ["judedabon123@gmail.com", "primeconceptanddesign@gmail.com"];
const scannerFilePath = path.join(__dirname, "scanner.json");
const pdfFileName = "monthly-report.pdf";
const reportMonth = new Date().getMonth() + 1; // current month
const reportYear = new Date().getFullYear();

// === HELPER FUNCTIONS ===

// Group data by department
function groupByDepartment(data) {
    const result = {};
    data.forEach(item => {
        const dept = item.department || "Unknown";
        if (!result[dept]) result[dept] = [];
        result[dept].push(item);
    });
    return result;
}

// Calculate monthly department totals
function departmentTotals(data) {
    const totals = {};
    data.forEach(item => {
        const date = new Date(item.date);
        if (date.getMonth() + 1 !== reportMonth || date.getFullYear() !== reportYear) return;
        const dept = item.department || "Unknown";
        totals[dept] = (totals[dept] || 0) + Number(item.qty || 0);
    });
    return totals;
}

// Find highest quantity item
function highestQtyItem(data) {
    const items = {};
    data.forEach(item => {
        const key = item.item;
        items[key] = (items[key] || 0) + Number(item.qty || 0);
    });
    let maxItem = null;
    let maxQty = 0;
    for (const [itemName, qty] of Object.entries(items)) {
        if (qty > maxQty) {
            maxQty = qty;
            maxItem = itemName;
        }
    }
    return { item: maxItem, qty: maxQty };
}

// Generate chart image using Chart.js
async function generateChartImage(labels, values, title) {
    const width = 600; 
    const height = 400; 
    const chartNode = new ChartjsNode(width, height);

    const config = {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: title,
                data: values,
                backgroundColor: '#004aad'
            }]
        },
        options: {
            responsive: false,
            plugins: {
                legend: { display: false },
                title: { display: true, text: title, font: { size: 16 } }
            }
        }
    };

    await chartNode.drawChart(config);
    const buffer = await chartNode.getImageBuffer('image/png');
    await chartNode.destroy();
    return buffer;
}

// === MAIN FUNCTION ===
async function generateAndSendPDF() {
    try {
        const rawData = fs.readFileSync(scannerFilePath, "utf8");
        const data = JSON.parse(rawData);

        const monthlyData = data.filter(item => {
            const d = new Date(item.date);
            return d.getMonth() + 1 === reportMonth && d.getFullYear() === reportYear;
        });

        const deptTotals = departmentTotals(monthlyData);
        const deptLabels = Object.keys(deptTotals);
        const deptValues = Object.values(deptTotals);

        const highestItem = highestQtyItem(monthlyData);

        // === CREATE PDF ===
        const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        doc.setFontSize(16);
        doc.text(`PRD Prime Monthly Report - ${reportMonth}/${reportYear}`, 10, 15);

        // Add department bar chart
        const deptChart = await generateChartImage(deptLabels, deptValues, "Quantity per Department");
        const deptChartData = `data:image/png;base64,${deptChart.toString('base64')}`;
        doc.addImage(deptChartData, "PNG", 10, 20, 180, 80);

        doc.setFontSize(12);
        doc.text(`Highest Quantity Item: ${highestItem.item} (${highestItem.qty})`, 10, 110);

        // Table with all monthly items
        const tableData = monthlyData.map(i => [i.date, i.item, i.client, i.department, i.qty]);
        doc.autoTable({
            head: [['Date', 'Item', 'Client', 'Department', 'Qty']],
            body: tableData,
            startY: 120,
            theme: 'grid',
            headStyles: { fillColor: [0, 74, 173], textColor: 255 },
            styles: { fontSize: 10 }
        });

        // Save PDF locally
        const pdfPath = path.join(__dirname, pdfFileName);
        doc.save(pdfPath);

        // === SEND EMAIL ===
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: { user: senderEmail, pass: appPassword }
        });

        await transporter.sendMail({
            from: `"PRD Prime Reports" <${senderEmail}>`,
            to: recipients.join(","),
            subject: `Monthly Barcode Report - ${reportMonth}/${reportYear}`,
            text: "Attached is the monthly barcode report.",
            attachments: [
                { filename: pdfFileName, path: pdfPath }
            ]
        });

        console.log("Monthly report generated and emailed successfully!");
    } catch (err) {
        console.error("Error generating or sending report:", err);
    }
}

// === RUN ===
generateAndSendPDF();
