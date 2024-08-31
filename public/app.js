document
    .getElementById("program-form")
    .addEventListener("submit", async function (e) {
        e.preventDefault();
        const nama = document.getElementById("nama").value;
        const demand = parseFloat(document.getElementById("demand").value);
        const cost = parseFloat(document.getElementById("cost").value);
        const resources = parseFloat(document.getElementById("resources").value);
        const academic_relevance = parseFloat(
            document.getElementById("academic_relevance").value
        );
        const student_interest = parseFloat(
            document.getElementById("student_interest").value
        );

        // console.log("Adding program:", {
        //     nama,
        //     demand,
        //     cost,
        //     resources,
        //     academic_relevance,
        //     student_interest,
        // });

        try {
            const response = await fetch("/programs", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    nama,
                    demand,
                    cost,
                    resources,
                    academic_relevance,
                    student_interest,
                }),
            });

            if (response.ok) {
                showModal("Program added successfully");
                loadPrograms();
                document.getElementById("program-form").reset();
            } else {
                alert("Failed to add program");
            }
        } catch (error) {
            console.error("Error adding program:", error);
        }
    });

async function loadPrograms() {
    try {
        const response = await fetch("/programs");
        if (!response.ok) {
            console.error("Failed to load programs", response.status, response.statusText);
            return;
        }

        const programs = await response.json();

        // Initialize DataTables
        $(document).ready(function () {
            $("#program-list").DataTable({
                data: programs,
                columns: [
                    { data: "nama" },
                    { data: "demand" },
                    { data: "cost" },
                    { data: "resources" },
                    { data: "academic_relevance" },
                    { data: "student_interest" },
                    { data: "skor_akhir" },
                    {
                        data: null,
                        render: function (data, type, row) {
                            return `
                <button onclick="viewDetails(${data.id})" class="btn btn-primary">Lihat Detail</button>
                <button onclick="deleteProgram(${data.id})" class="btn btn-danger">Hapus</button>
              `;
                        },
                    },
                ],
                destroy: true, // Allow re-initialization
            });
        });

        const names = programs.map((p) => p.nama);
        const scores = programs.map((p) => p.skor_akhir);

        const maxScore = Math.max(...scores);
        const minScore = Math.min(...scores);
        const bestProgramIndex = scores.indexOf(maxScore);
        const worstProgramIndex = scores.indexOf(minScore);
        const bestProgramName = names[bestProgramIndex];
        const worstProgramName = names[worstProgramIndex];

        const canvas = document.getElementById("myChart");
        const ctx = canvas.getContext("2d");

        if (window.myChart instanceof Chart) {
            window.myChart.destroy();
        }

        window.myChart = new Chart(ctx, {
            type: "bar",
            data: {
                labels: names,
                datasets: [
                    {
                        label: "Skor Akhir",
                        data: scores,
                        backgroundColor: scores.map((score) =>
                            score === maxScore ? "green" :
                                score === minScore ? "red" : "skyblue"
                        ),
                    },
                ],
            },
            options: {
                scales: {
                    y: {
                        beginAtZero: true,
                    },
                },
                plugins: {
                    title: {
                        display: true,
                        text: `Program Studi Terbaik: ${bestProgramName} | Program Studi Terburuk: ${worstProgramName}`,
                    },
                },
            },
        });
    } catch (error) {
        console.error("Error loading programs:", error);
    }
}


function showModal(message) {
    const modalBody = document.getElementById("modal-body-text");
    modalBody.textContent = message;
    const confirmationModal = new bootstrap.Modal(
        document.getElementById("confirmationModal")
    );
    confirmationModal.show();
}

async function deleteProgram(id) {
    console.log(`Preparing todelete program with ID: ${id}`);

    try {
        const response = await fetch(`/programs/${id}`, {
            method: "DELETE",
        });

        if (response.ok) {
            showModal("Program deleted successfully");
            loadPrograms(); // Reload programs after deletion
        } else {
            alert("Failed to delete program");
        }
    } catch (error) {
        console.error(`Error deleting program with ID ${id}:`, error);
    }
}

async function viewDetails(id) {
    console.log(`Fetching details for program with ID: ${id}`);
    try {
        window.location.href = `/programs/transpose/${id}`;
    } catch (error) {
        console.error(`Error fetching details for program ${id}:`, error);
    }
}

// Event listener for export button
document.getElementById("export-csv").addEventListener("click", function () {
    const exportModal = new bootstrap.Modal(
        document.getElementById("exportConfirmationModal")
    );
    exportModal.show();
});

// Confirm export
document
    .getElementById("confirm-export")
    .addEventListener("click", function () {
        window.location.href = "/export";
        const exportModal = new bootstrap.Modal(
            document.getElementById("exportConfirmationModal")
        );
        exportModal.hide();
    });

// Event listener for CSV upload form
document
    .getElementById("csv-form")
    .addEventListener("submit", async function (e) {
        e.preventDefault();
        const formData = new FormData();
        const fileField = document.getElementById("csv-file");
        formData.append("csvfile", fileField.files[0]);

        try {
            const response = await fetch("/upload", {
                method: "POST",
                body: formData,
            });

            if (response.ok) {
                showModal("CSV file imported successfully");
                loadPrograms();
            } else {
                alert("Failed to import CSV file");
            }
        } catch (error) {
            console.error("Error importing CSV file:", error);
        }
    });

loadPrograms();
