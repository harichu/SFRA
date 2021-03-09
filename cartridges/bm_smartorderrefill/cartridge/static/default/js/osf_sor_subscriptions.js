/**
 *  Property of OSF Global Services, Inc., (with its brand OSF Commerce). OSF remains the sole owner of all right, title and interest in the software.
 *  Do not copy, sell, reverse engineer or otherwise attempt to derive or obtain information about the functioning, manufacture or operation therein.
 */
function initDatePicker() {
    
    var from = $( "#date_from input" )
    .datepicker({
        defaultDate: "+1w",
        changeMonth: true,
        changeYear : true,
        numberOfMonths: 1
    })
    .on( "change", function() {
        to.datepicker( "option", "minDate", getDate( this ) );
    });
    var to = $( "#date_to input" )
    .datepicker({
        defaultDate: "+1w",
        changeMonth: true,
        changeYear : true,
        numberOfMonths: 1
    })
    .on( "change", function() {
        from.datepicker( "option", "maxDate", getDate( this ) );
    });
}

function getDate( element ) {
    var dateFormat = "mm/dd/yy";
    var date;
    try {
        date = $.datepicker.parseDate( dateFormat, element.value );
    } catch( error ) {
        date = null;
    }

    return date;
}
function initEvents() {
    $( ".toggle-visibility" ).click(function() {
        $( ".report_q_table" ).toggle("slow");
    });
}

function alignFilterLabels() {
    var labelWidth = [];
    $('.sor-module__filter_table tr').each(function(){
        var $tds = $(this).find('td');
        $tds.each(function(index){
            var $label = $(this).find('label');
            if ($label.length > 0 && ($label.width() > labelWidth[index] || typeof labelWidth[index] == 'undefined' )) {
                labelWidth[index] = $label.width();
            }
        });
    });
    $('.sor-module__filter_table tr').each(function(){
        var $tds = $(this).find('td');
        $tds.each(function(index){
            $(this).find('label').width(labelWidth[index] + 5);

        });
    });
}

function modalContainer(body, id) {
    var ID = id || 'sorModal';
    var bootstrap = `<div class="modal fade" id="${ID}" tabindex="-1" role="dialog" aria-labelledby="sorModalTitle"
    aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <div class="modal-body">
                ${body}
            </div>
      </div>
    </div>
  </div>`
  return bootstrap;
}

function modal(selector) {
    $(selector).on('click', function(e) {
        e.preventDefault();
        e.stopImmediatePropagation();

        var url = $(this).data('link');

        if(!$('#sorModal').length){
            $("body").append(modalContainer(''));
        }
        
        $.get(url, function( data ) {
            $('#sorModal .modal-body').html(data);
          });

        if($('#sorModal.show').length == 0) {
            $('#sorModal').modal('show');

            $('#sorModal').on('hidden.bs.modal', function (e) {
                if($('body').hasClass('reloadPage')) {
                    window.location.reload();
                }
            });
        }
    });
}


function initModal() {
    modal('.memberSubscription');
    modal('.subscription-section .sor-table-order');
    modal('.back-from-fee');
}

function confirmationModal(title, body, yes, no, func) {
    var header = `<h4 class="modal-title">${title}</h4>`;
    var yesButton = yes ? `<button type="button" class="btn-yes" id='confirm_yes'>${yes}</button>` : '<input type="hidden" value="true">'
    var buttons = 
        `<div class="modal-footer">
            ${yesButton}
            <button type="button" class="btn" data-dismiss="modal">${no}</button>
        </div>`;
    var modal_header = 
        `<div class="modal-header">
            <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                <span aria-hidden="true">&times;</span>
            </button>
        </div>`
    if(!$('#confirmModal').length){
        $("body").append(modalContainer('', 'confirmModal'));
        $("#confirmModal").addClass('confirm_alert');
        $('#confirmModal .modal-body').html(body);
        $('#confirmModal .modal-content').append(buttons);
        $('#confirmModal .modal-content .modal-header').prepend(header);
    } else {
        $('#confirmModal .modal-content').html(modal_header);
        
        $('#confirmModal .modal-content .modal-header').prepend(header);
        $('#confirmModal .modal-content').append('<div class="modal-body">' + body +'</div>');
        $('#confirmModal .modal-content').append(buttons); 
    }

    if($('#confirmModal.show').length == 0) {
        $('#confirmModal').modal('show');
    }
    $('#confirm_yes').on('click', function() {
        $('#confirmModal').modal('hide');
        func();
    })
    $('#confirmModal').on('hidden.bs.modal', function (e) {
        $("body").addClass("modal-open");
    })
}

function reactivateRenewal() {
    $('.reactivate.renewal').on('click', function() {
        var url = $(this).data('link');
        $.get(url, function(res) {
            $.get(res.reloadUrl, function(data) {
                $('#sorModal .modal-body').html(data);
            })
        })
    })
}

function cancelRenewal() {
    $('.cancel.renewal').on('click', function(e) {
        var url = $(this).data('link');
        confirmationModal(window.sor_resources.cancelRenewal_header, window.sor_resources.cancelRenewal_message, window.sor_resources.yes,window.sor_resources.no, cancelRen);

        function cancelRen() {
            $.get(url, function(res) {
                $.get(res.reloadUrl, function(data) {
                    $('#sorModal .modal-body').html(data);
                })
            })
        }
        
    })
}

function pauseSubscription() {
    $('.pause.subscription').on('click', function(e) {
        var url = $(this).data('link');
        confirmationModal(window.sor_resources.pause_subscription_header, window.sor_resources.pause_subscription_message, window.sor_resources.yes,window.sor_resources.no, pauseSubs);

        function pauseSubs() {
            $.get(url, function(res) {
                $.get(res.reloadUrl, function(data) {
                    $('#sorModal .modal-body').html(data);
                })
            })
        }
    })
}

function reactivateSubscription() {
    $('.reactivate.subscription').on('click', function(e) {
        var url = $(this).data('link');
        $.get(url, function(body){ 
            confirmationModal(window.sor_resources.reactivate_subscription_header, body, window.sor_resources.save, window.sor_resources.cancel, reactivateSubs);
        })
                   
        function reactivateSubs() {
            var action = $('#reactivatePeriodForm').data('link');
            $.ajax({
                type: "POST",
                url: action,
                data: $(this).serialize(),
                success: function(data) {
                    $.get(data.reloadUrl, function(page) {
                        $('#sorModal .modal-body').html(page);
                    }) 
                }
            })
        }
    })
}

function pauseOrder() {
    $('.order.pause').on('click', function(e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        var url = $(this).data('link'),
            realoadUrl = $(this).data('reload');
            confirmationModal(window.sor_resources.pause_order_header, window.sor_resources.pause_order_message, window.sor_resources.yes, window.sor_resources.no, pause);

        function pause(){
            $.get(url, function() {
                $.get(realoadUrl, function( data ) {
                    $('#sorModal .modal-body').html(data);
                    $('body').addClass('reloadPage');
                  });
            })
        }

    })
}

function reactivateORder() {
    $('.order.reactivate').on('click', function() {
        var url = $(this).data('link'),
        realoadUrl = $(this).data('reload');
        $.get(url, function(res) {
            $.get(realoadUrl, function( data ) {
                $('#sorModal .modal-body').html(data);
                $('body').addClass('reloadPage');
              });
            
        })
    })
}

function skipOrder() {
    $('.button.order.skip').on('click', function(e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        var url = $(this).data('link');
        var isLast = $(this).data('last');
            if(isLast <=1 ) {
                confirmationModal(window.sor_resources.skip_order_header, window.sor_resources.skip_order_lastorder, "", window.sor_resources.ok, skip);        
            } else {
                confirmationModal(window.sor_resources.skip_order_header, window.sor_resources.skip_order_message, window.sor_resources.yes, window.sor_resources.no, skip);
            }

        function skip() {
            $.get(url, function(res) {
                if (res.subscriptionsUrl) {
                    $.get(res.subscriptionsUrl, function(data) {
                        $('#sorModal .modal-body').html(data);
                    })
                } else {
                    window.location.reload();
                }
            })
        }

    })
}

function cancelSubscription() {
    $('.button.cancel.subscription').on('click', function(e) {
        e.preventDefault();
        var url = $(this).data('link');
       
            confirmationModal(window.sor_resources.cancel_subscription_header, window.sor_resources.cancel_subscription_message, window.sor_resources.yes,window.sor_resources.no, cancel);

            function cancel() {
                $.get(url, function(res) {
                    if (res.subscriptionsUrl) {
                        $.get(res.subscriptionsUrl, function(data) {
                            $('#sorModal .modal-body').html(data);
                        })
                    }
                })
            }
       
    })

    $('.back-from-fee').on('click', function() {
        var url = $(this).data('link');
        $.get(url, function(data) {
            $('#sorModal .modal-body').html(data);
        })
    })
}

function removeProduct() {
    $('#subscription-details .remove_product .button').on('click', function(e) {
        e.preventDefault();
        var url = $(this).data('link');
        e.stopImmediatePropagation();

        confirmationModal(window.sor_resources.removeProd_header, window.sor_resources.removeProd_message, window.sor_resources.yes,window.sor_resources.no, remove);
        function remove() {
            $.get(url, function(res) {
                if (res.subscriptionsUrl) {
                    $.get(res.subscriptionsUrl, function(data) {
                        $('body').append(modalContainer(data));
                        $('#sorModal').modal('show');
                    }) 
                } else {
                    window.location.reload();
                }
            })
        }
    })
}

function sumbitFee() {
    $('#confirm_fee').on('click', function() {
        var url =$(this).data('link');
        $.ajax({
            type: "POST",
            url: url,
            data: $('#fee-form').serialize(),
            success: function(data) {
                if (data.subscriptionsUrl) {
                    $.get(data.subscriptionsUrl, function(subsData) {
                        $('#sorModal .modal-body').html(subsData);
                    });
                } else {
                    window.location.reload();
                }
            }
        });
    })
}

function redirectToDetails() {
    $('.orderSummary, .subscriptionSummary').on('click', function() {
        window.location.replace($(this).data('link'));
    })
}

function change() {
    $('.sor-filter-checkbox .form-row').each(function() {
        var label = $(this).children()[0],
            input = $(this).children()[1];
        $(this).html(input).append(label);
    });

    var tableWidth = $('.report_table_container').width();
    $('.report_table_container+table').width(tableWidth);
}

function resetOrderSummaryForm() {
    $('#reset-button').on('click', function () {
        $('#ordersummary-form input[type=text]').each(function () {
            $(this).val('');
        })
        $('#ordersummary-form input[type=checkbox]').each(function () {
            $(this).prop('checked', false);
        })
    });
}

function detailsRoute() {
    $('#subscription-details-nav span').on('click',function() {
        var customClass = this.classList[0];
        $('#subscription-details-nav span').each(function(){
            if($(this).hasClass('selected')) {
                $(this).removeClass('selected');
            }
        })

        $(this).addClass('selected');
        $('#subscription-details .order-section').each(function(key, val) {
            if(!($(val).hasClass('visualy-hidden')) && !($(val).hasClass(customClass))) {
                    $(val).addClass('visualy-hidden');
            }
            if($(val).hasClass(customClass)) {
                $(val).removeClass('visualy-hidden')
            }
        })
    })
}

function filterProductVariants() {
    var selectedProductID = $('input[name="selectedProductID"').val()
    var selectedVariationID = $('input[name="selectedVariationID"').val()
   
    $('#dwfrm_editproduct_product').children('option').filter(function() { 
        return ($(this).val() == selectedProductID);  
    }).prop('selected', true);

    $('#dwfrm_editproduct_variation').children("option").filter(function() { 
        return ($(this).val() == selectedVariationID);  
    }).prop('selected', true);

    $('#dwfrm_editproduct_variation').children("option").filter(function() { 
        return ($(this).data("master") != selectedProductID);  
    }).hide();

    $('#dwfrm_editproduct_product').on('change', function() {
        var selectedProduct = $(this).children("option:selected").val();
        var variations = $('#dwfrm_editproduct_variation').children("option");
        variations.show();
        for (var i = 0; i < variations.length; i++) {
            var variants = variations[i]
            var variant = $(variants).data("master");
            if (selectedProduct != variant) {
                $('#dwfrm_editproduct_variation').children('option[data-master='+'"'+variant+'"'+']').hide();
            }
            if (selectedProduct == variant) { 
                $('#dwfrm_editproduct_variation').children("option").filter(function() { 
                    return ($(this).data("master") == selectedProduct);  
                }).prop('selected', true);
            }
        }
    })
}

function filterProductRefill() {
    var periodicity = $('input[name="selectedPeriodicity"').val(),
        interval = $('input[name="selectedInterval"').val(),
        periods =  $('#dwfrm_editproduct_periodicity').children("option");

    $('#dwfrm_editproduct_periodicity').children('option').filter(function() { 
        return ($(this).val() == periodicity);  
    }).prop('selected', true);

    $('#dwfrm_editproduct_interval').children('option').filter(function() { 
        return ($(this).val() == interval);  
    }).prop('selected', true);
  
    if (periods.length > 1) {
        $('#dwfrm_editproduct_interval').children("option").filter(function() { 
            return ($(this).data("periodicity") != periodicity);  
        }).hide();
    }
    
    $('#dwfrm_editproduct_periodicity').on('change', function() {
        var selectedPeriod = $(this).children("option:selected").val();
        var intervals = $('#dwfrm_editproduct_interval').children("option");
        intervals.show();
        for (var i = 0; i < intervals.length; i++) {
            var interval = intervals[i]
            var intervalPeriod = $(interval).data("periodicity");
            if (selectedPeriod != intervalPeriod) {
              $('#dwfrm_editproduct_interval').children('option[data-periodicity='+'"'+intervalPeriod+'"'+']').hide();
            }
        }
    })

}

$(document).ready(function(){
    initDatePicker();
    initEvents();
    alignFilterLabels();
    change();
    detailsRoute();
    resetOrderSummaryForm();
    initModal();
    skipOrder();
    pauseOrder();
    removeProduct();
    reactivateORder();
    cancelSubscription();
    reactivateSubscription();
    pauseSubscription();
    redirectToDetails();
    cancelRenewal();
    reactivateRenewal();
    sumbitFee();
    filterProductVariants();
    filterProductRefill();
});