import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";
import { jsPDF } from "jspdf";
import JsBarcode from "jsbarcode";
import { createCanvas } from "canvas";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";

export async function generateAndSendReport() {
  try {
    console.log("Generating PDF report...");

    // Load scanner.json
    const scannerPath = path.join("./scanner.json");
    const data = JSON.parse(fs.readFileSync(scannerPath, "utf8"));

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    let y = 10;

    // Title
    doc.setFontSize(14);
    doc.text("Monthly Barcode Report", 105, y, { align: "center" });
    y += 10;

    // --- Data Aggregation ---
    const monthlyData = data.reduce((acc, d) => {
      const month = new Date(d.date).toLocaleString("default", { month: "long" });
      if (!acc[month]) acc[month] = {};
      if (!acc[month][d.department]) acc[month][d.department] = 0;
      acc[month][d.department] += d.qty;
      return acc;
    }, {});

    // Most delivered item
    const itemTotals = {};
    data.forEach(d => {
      if (!itemTotals[d.item]) itemTotals[d.item] = 0;
      itemTotals[d.item] += d.qty;
    });
    const topItem = Object.entries(itemTotals).sort((a, b) => b[1] - a[1])[0];

    // Most active department
    const deptTotals = {};
    data.forEach(d => {
      if (!deptTotals[d.department]) deptTotals[d.department] = 0;
      deptTotals[d.department] += d.qty;
    });
    const topDept = Object.entries(deptTotals).sort((a, b) => b[1] - a[1])[0];

    // --- Generate Charts ---
    const width = 500;
    const height = 300;
    const chartCallback = (ChartJS) => {};
    const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height, chartCallback });

    // Department vs Quantity chart
    const deptChartConfig = {
      type: "bar",
      data: {
        labels: Object.keys(deptTotals),
        datasets: [{
          label: "Quantity per Department",
          data: Object.values(deptTotals),
          backgroundColor: "rgba(54, 162, 235, 0.6)",
        }],
      },
      options: { plugins: { legend: { display: true } } },
    };
    const deptImage = await chartJSNodeCanvas.renderToBuffer(deptChartConfig, "image/png");
    doc.addImage(deptImage, "PNG", 15, y, 180, 90);
    y += 95;

    // Item vs Quantity chart
    const itemChartConfig = {
      type: "bar",
      data: {
        labels: Object.keys(itemTotals),
        datasets: [{
          label: "Quantity per Item",
          data: Object.values(itemTotals),
          backgroundColor: "rgba(255, 99, 132, 0.6)",
        }],
      },
      options: { plugins: { legend: { display: true } } },
    };
    const itemImage = await chartJSNodeCanvas.renderToBuffer(itemChartConfig, "image/png");
    doc.addPage();
    y = 10;
    doc.addImage(itemImage, "PNG", 15, y, 180, 90);
    y += 95;

    // --- Add Table ---
    const tableData = data.map(d => [d.date, d.item, d.client, d.department, d.qty]);
    doc.autoTable({
      head: [["Date", "Item", "Client", "Department", "Quantity"]],
      body: tableData,
      startY: y,
      styles: { fontSize: 8 },
    });

    const pdfPath = path.join("./monthly-report.pdf");
    doc.save(pdfPath);

    console.log("PDF generated at:", pdfPath);

    // --- Send Email ---
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: "judedabon123@gmail.com, primeconceptanddesign@gmail.com",
      subject: `Monthly Barcode Report - ${new Date().toLocaleString("default", { month: "long", year: "numeric" })}`,
      text: `Monthly report attached.\n\nTop Department: ${topDept[0]} (${topDept[1]} units)\nTop Item: ${topItem[0]} (${topItem[1]} units)`,
      attachments: [{ path: pdfPath }],
    };

    await transporter.sendMail(mailOptions);
    console.log("Email sent successfully!");
  } catch (err) {
    console.error("Error generating or sending report:", err);
  }
}
