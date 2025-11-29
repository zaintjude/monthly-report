import nodemailer from "nodemailer";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import fetch from "node-fetch";

// Fetch scanner.json from your hosting
async function getScannerData() {
  const url = "https://dashproduction.x10.mx/masterfile/scanner/machining/barcode/scanner.json";
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("Failed to fetch scanner.json:", err);
    return []; // fallback
  }
}

export async function generateAndSendReport() {
  try {
    console.log("Generating PDF report...");

    const data = await getScannerData();

    if (!data.length) {
      console.log("No data available to generate report.");
      return;
    }

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    let y = 10;

    // Title
    doc.setFontSize(14);
    doc.text("Monthly Barcode Report", 105, y, { align: "center" });
    y += 10;

    // --- Data Aggregation ---
    const deptTotals = {};
    const itemTotals = {};
    data.forEach(d => {
      deptTotals[d.department] = (deptTotals[d.department] || 0) + d.qty;
      itemTotals[d.item] = (itemTotals[d.item] || 0) + d.qty;
    });

    const topDept = Object.entries(deptTotals).sort((a, b) => b[1] - a[1])[0];
    const topItem = Object.entries(itemTotals).sort((a, b) => b[1] - a[1])[0];

    // --- Table ---
    const tableData = data.map(d => [d.date, d.item, d.client, d.department, d.qty]);
    autoTable(doc, {
      head: [["Date", "Item", "Client", "Department", "Quantity"]],
      body: tableData,
      startY: y,
      styles: { fontSize: 8 },
    });

    // --- Send Email ---
    const pdfBytes = doc.output("arraybuffer"); // PDF in memory

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
      attachments: [
        {
          filename: "monthly-report.pdf",
          content: Buffer.from(pdfBytes),
        }
      ],
    };

    await transporter.sendMail(mailOptions);
    console.log("Email sent successfully!");

  } catch (err) {
    console.error("Error generating or sending report:", err);
  }
}
