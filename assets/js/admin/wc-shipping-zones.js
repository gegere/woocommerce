/* global shippingZonesLocalizeScript, ajaxurl */
( function( $, data, wp, ajaxurl ) {
	$( function() {

        var $table             = $( '.wc_shipping_zones' ),
            $tbody             = $( '.wc-shipping-zone-rows' ),
            $save_button       = $( 'input[name="save"]' ),

            // Backbone model
            ShippingZone       = Backbone.Model.extend({
                changes: {},
				logChanges: function( changedRows ) {
					var changes = this.changes || {};

					_.each( changedRows, function( row, id ) {
						changes[ id ] = _.extend( changes[ id ] || { zone_id : id }, row );
					} );

					this.changes = changes;
					this.trigger( 'change:zones' );
				},
				save: function() {
					if ( _.size( this.changes ) ) {
						$.post( ajaxurl + '?action=woocommerce_shipping_zones_save_changes', {
							wc_shipping_zones_nonce : data.wc_shipping_zones_nonce,
							changes                 : this.changes
						}, this.onSaveResponse, 'json' );
					} else {
						shippingZone.trigger( 'saved:zones' );
					}
				},
				onSaveResponse: function( response, textStatus ) {
					if ( 'success' === textStatus ) {
						if ( response.success ) {
							shippingZone.set( 'zones', response.data.zones );
							shippingZone.trigger( 'change:zones' );
							shippingZone.changes = {};
							shippingZone.trigger( 'saved:zones' );
						} else {
							alert( data.strings.save_failed );
						}
					}
				}
			} ),

            // Backbone view
			ShippingZoneView = Backbone.View.extend({
				rowTemplate: wp.template( 'wc-shipping-zone-row' ),
				initialize: function() {
					this.listenTo( this.model, 'change:zones', this.setUnloadConfirmation );
					this.listenTo( this.model, 'saved:zones', this.clearUnloadConfirmation );
					this.listenTo( this.model, 'saved:zones', this.render );
					$tbody.on( 'change', { view: this }, this.updateModelOnChange );
					$tbody.on( 'sortupdate', { view: this }, this.updateModelOnSort );
					$( window ).on( 'beforeunload', { view: this }, this.unloadConfirmation );
					$save_button.on( 'click', { view: this }, this.onSubmit );
					$save_button.attr( 'disabled','disabled' );
					$table.find( '.wc-shipping-zone-add' ).on( 'click', { view: this }, this.onAddNewRow );
				},
				render: function() {
					var zones       = _.indexBy( this.model.get( 'zones' ), 'zone_id' ),
						view        = this;

					// Blank out the contents.
					this.$el.empty();

					if ( _.size( zones ) ) {
						// Sort zones
						zones = _.sortBy( zones, function( zone ) {
							return parseInt( zone.zone_order, 10 );
						} );

						// Populate $tbody with the current zones
						$.each( zones, function( id, rowData ) {
							view.$el.append( view.rowTemplate( rowData ) );
						} );

                        // Make the rows functiothis.$el.find( '.wc-shipping-zone-delete' ).on( 'click', { view: this }, this.onDeleteRow );
						this.$el.find('.view').show();
						this.$el.find('.edit').hide();
						this.$el.find( '.wc-shipping-zone-edit' ).on( 'click', { view: this }, this.onEditRow );
                        this.$el.find( '.wc-shipping-zone-delete' ).on( 'click', { view: this }, this.onDeleteRow );

                        // Stripe
                        if ( _.size(zones) % 2 == 0 ) {
                            $table.find( 'tbody.wc-shipping-zone-rows').next('tbody').find('tr').addClass('odd');
                        } else {
                            $table.find( 'tbody.wc-shipping-zone-rows').next('tbody').find('tr').removeClass('odd');
                        }
                    }
				},
				onSubmit: function( event ) {
					event.data.view.model.save();
					event.preventDefault();
				},
				onAddNewRow: function( event ) {
					var view    = event.data.view,
						model   = view.model,
						zones   = _.indexBy( model.get( 'zones' ), 'zone_id' ),
						changes = {},
						size    = _.size( zones ),
						newRow  = _.extend( {}, data.default_zone, {
							zone_id: 'new-' + size + '-' + Date.now(),
							newRow:  true
						} );

					newRow.zone_order = 1 + _.max(
						_.pluck( zones, 'zone_order' ),
						function ( val ) {
							// Cast them all to integers, because strings compare funky. Sighhh.
							return parseInt( val, 10 );
						}
					);

					zones[ newRow.zone_id ]   = newRow;
					changes[ newRow.zone_id ] = newRow;

					model.set( 'zones', zones );
					model.logChanges( changes );

					view.render();
					$table.find( 'tr[data-id="' + newRow.zone_id + '"] .wc-shipping-zone-edit' ).trigger( 'click' );

                    return false;
				},
				onEditRow: function( event ) {
					event.preventDefault();
					$( this ).closest('tr').find('.view, .wc-shipping-zone-edit').hide();
					$( this ).closest('tr').find('.edit').show();
					event.data.view.model.trigger( 'change:zones' );
				},
				onDeleteRow: function( event ) {
					var view    = event.data.view,
						model   = view.model,
						zones   = _.indexBy( model.get( 'zones' ), 'zone_id' ),
						changes = {},
						zone_id = $( this ).closest('tr').data('id');

					event.preventDefault();

					delete zones[ zone_id ];
					changes[ zone_id ] = _.extend( changes[ zone_id ] || {}, { deleted : 'deleted' } );
					model.set( 'zones', zones );
					model.logChanges( changes );
					view.render();
				},
				setUnloadConfirmation: function() {
					this.needsUnloadConfirm = true;
					$save_button.removeAttr( 'disabled' );
				},
				clearUnloadConfirmation: function() {
					this.needsUnloadConfirm = false;
					$save_button.attr( 'disabled', 'disabled' );
				},
				unloadConfirmation: function( event ) {
					if ( event.data.view.needsUnloadConfirm ) {
						event.returnValue = data.strings.unload_confirmation_msg;
						window.event.returnValue = data.strings.unload_confirmation_msg;
						return data.strings.unload_confirmation_msg;
					}
				},
				updateModelOnChange: function( event ) {
					var model     = event.data.view.model,
						$target   = $( event.target ),
						zone_id   = $target.closest( 'tr' ).data( 'id' ),
						attribute = $target.data( 'attribute' ),
						value     = $target.val(),
						zones   = _.indexBy( model.get( 'zones' ), 'zone_id' ),
						changes = {};

					if ( zones[ zone_id ][ attribute ] !== value ) {
						changes[ zone_id ] = {};
						changes[ zone_id ][ attribute ] = value;
						zones[ zone_id ][ attribute ]   = value;
					}

					model.logChanges( changes );
				},
				updateModelOnSort: function( event, ui ) {
					var view         = event.data.view,
						model        = view.model,
						$tr          = ui.item,
						zone_id      = $tr.data( 'id' ),
						zones        = _.indexBy( model.get( 'zones' ), 'zone_id' ),
						changes      = {};

					reordered_zones = _.map( zones, function( zone ) {
						var old_position = parseInt( zone.zone_order, 10 );
						var new_position = parseInt( $table.find( 'tr[data-id="' + zone.zone_id + '"]').index(), 10 );

						if ( old_position !== new_position ) {
							changes[ zone.zone_id ] = _.extend( changes[ zone.zone_id ] || {}, { zone_order : new_position } );
						}

						return zone;
					} );

					if ( _.size( changes ) ) {
						model.logChanges( changes );
					}
				}
			} ),
			shippingZone = new ShippingZone({
				zones: data.zones
			} ),
			shippingZoneView = new ShippingZoneView({
				model:    shippingZone,
				el:       $tbody
			} );

		shippingZoneView.render();
        $tbody.sortable({
			items: 'tr',
			cursor: 'move',
			axis: 'y',
			handle: 'td.wc-shipping-zone-sort',
			scrollSensitivity: 40
		});
	});
})( jQuery, shippingZonesLocalizeScript, wp, ajaxurl );