"use strict";

module.exports = function () {

    // Set the min year to create an account
    var newDate = new Date();
    newDate = newDate.setFullYear(newDate.getFullYear() - 18);

    // Set the start Date in 99 years ago
    var startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 99);

    // Creates the custom datepicker
    $("[data-toggle='datepicker']").datepicker({
        language: "es-co",
        format: "dd/mm/yyyy",
        date: newDate,
        startDate: startDate,
        endDate: new Date(),
        autoHide: true,
        days:["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"],
        daysShort: ["Dom", "Lun", "Mar", "Mier", "Jue", "Vier", "Sab"],
        daysMin: ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"],
        months: ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"],
        monthsShort: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"],
        inline: true,
        container: ".docs-datepicker-container",
        template: "<div class='datepicker-container'> <div class='datepicker-panel years-picker' data-view='years picker'> <ul class='selected-year'> <li data-view='years prev'>&lsaquo;</li><li data-view='years current'></li><li data-view='years next'>&rsaquo;</li></ul> <ul class='years' data-view='years'></ul> </div><div class='datepicker-panel months-picker' data-view='months picker'> <ul> <li data-view='year prev'>&lsaquo;</li><li data-view='year current'></li><li data-view='year next'>&rsaquo;</li></ul> <ul class='months' data-view='months'></ul> </div><div class='datepicker-panel days-picker' data-view='days picker'> <ul class='selected-month d-flex'> <li class='prev-year' data-view='month prev'>&lsaquo;&lsaquo;</li><li class='prev-month' data-view='month prev'>&lsaquo;</li><li data-view='month current'></li><li class='next-month' data-view='month next'>&rsaquo;</li><li class='next-year' data-view='month next'>&rsaquo;&rsaquo;</li></ul> <ul class='weeks 'data-view='week'></ul> <ul class='days' data-view='days'></ul> </div></div>"
    });

    // Hide native calendars
    $("[data-toggle='datepicker']").on("click", function (e) {
        e.preventDefault();
    });

    $("#datefield").on("focus", function () {
        $(".docs-datepicker-container").removeClass("d-none");
        $(".docs-datepicker-container").addClass("d-flex");
    });

    $(".prev-year").on("click", function (e) {
        if ($(this).hasClass("disabled")) {
            e.preventDefault();
        } else {
            for (var x = 0; x <= 10; x++) {
                $(".prev-month").click();
            }
        }
    });

    $(".next-year").on("click", function (e) {
        if ($(this).hasClass("disabled")) {
            e.preventDefault();
        } else {
            for (var x = 0; x <= 10; x++) {
                $(".next-month").click();
            }
        }
    });

    // Disable next-year button if the calendar is displaying the current year
    $(".prev-month, .next-month, .prev-year, .next-year").on("click", function () {
        var currentYear = new Date().getFullYear();
        var currentCalendar = $("[data-view='month current']").text();
        if (currentCalendar.indexOf(currentYear) !== -1) {
            setTimeout(function () {
                $(".next-year").addClass("disabled");
            }, 1);
        }
    });

    $("[data-toggle='datepicker']").on("pick.datepicker", function () {
        $(".docs-datepicker-container").removeClass("d-flex");
        $(".docs-datepicker-container").addClass("d-none");
    });

    // Check if has a value on the input
    function checkDate(el) {
        if ($(el).val().length > 0) {
            $(el).addClass("has-value");
        } else {
            $(el).removeClass("has-value");
        }
    }

    // Check the date input on change
    $("input[type='date'].custom-select").on("change", function () {
        checkDate(this);
    });

    // Close the datepicker on click outside input or calendar
    $(document).click(function (e) {
        var container = $(".datefield");
        if (!container.is(e.target) && container.has(e.target).length === 0) {
            $(".docs-datepicker-container").addClass("d-none");
            $(".docs-datepicker-container").removeClass("d-flex");
        }
    });
};
